import { Elysia } from 'elysia'
import { node } from '@elysiajs/node'
import cors from '@elysiajs/cors'
import { staticPlugin } from '@elysiajs/static'
import { openapi } from '@elysiajs/openapi'
import { bearer } from '@elysiajs/bearer'
import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import type { AppConfig } from '../config/loader.js'
import type { DeviceRegistry } from '../core/deviceRegistry.js'
import type { SampleRepo, AlarmRepo } from '../storage/repositories.js'
import type { PiAgent } from '../pi/agent.js'
import { devicesRoutes } from './routes/devices.js'
import { samplesRoutes } from './routes/samples.js'
import { alarmsRoutes } from './routes/alarms.js'
import { controlRoutes } from './routes/control.js'
import { piRoutes } from './routes/pi.js'
import { streamRoutes } from './routes/stream.js'
import { piAgentLLMRoutes } from './routes/piAgent.js'
import { llmProviderRoutes } from './routes/llmProviders.js'
import { LLMProviderRepo } from '../storage/llmProviderRepo.js'
import type { AuditRepo } from '../storage/repositories.js'

export interface Deps {
  cfg: AppConfig
  registry: DeviceRegistry
  samples: SampleRepo
  alarms: AlarmRepo
  audit: AuditRepo
  pi: PiAgent
  llmProviders: LLMProviderRepo
}

/**
 * Build the Elysia app. Does NOT call .listen() — caller is responsible.
 * Exporting this as the type source for Eden end-to-end types.
 */
export function buildApp(deps: Deps) {
  const app = new Elysia({ adapter: node() })
    .use(cors())
    // Optional Bearer auth: when ENVCTRL_API_TOKEN is set, every /api/* request
    // (except /api/health and /api/stream) must carry `Authorization: Bearer <token>`.
    // This is enough for LAN deployment; for multi-user see Better Auth plugin.
    .use(
      bearer({
        extract: { header: 'Authorization' },
      })
    )
    .onBeforeHandle(({ request, set, path }) => {
      const required = process.env.ENVCTRL_API_TOKEN
      if (!required) return
      // Public paths: health, SSE stream, OpenAPI docs
      if (
        path === '/api/health' ||
        path.startsWith('/api/stream') ||
        path.startsWith('/openapi')
      ) return
      const auth = request.headers.get('authorization')
      if (auth !== `Bearer ${required}`) {
        set.status = 401
        return { message: 'Unauthorized' }
      }
    })
    // Hardware-aware error handling: log all unhandled errors with stack
    .onError(({ code, error, set, path }) => {
      const msg = error instanceof Error ? error.message : String(error)
      // eslint-disable-next-line no-console
      console.error(`[api error] ${path} ${code}: ${msg}`)
      if (code === 'VALIDATION') {
        set.status = 422
        return { message: 'validation error', detail: msg }
      }
      if (code === 'NOT_FOUND') {
        set.status = 404
        return { message: 'not found' }
      }
      set.status = 500
      return { message: 'internal error' }
    })
    // Auto-generated OpenAPI spec + Swagger UI at /openapi
    .use(
      openapi({
        documentation: {
          info: {
            title: 'envctrl API',
            version: '0.1.0',
            description: 'Raspberry Pi environment control — devices, samples, alarms, control, Pi agent',
          },
          tags: [
            { name: 'devices', description: 'Device registry and current state' },
            { name: 'samples', description: 'Time-series history per device/point' },
            { name: 'alarms', description: 'Active and recent alarm events' },
            { name: 'control', description: 'Write commands to devices' },
            { name: 'pi', description: 'Pi system introspection and configuration' },
          ],
        },
      })
    )

  // Serve web/dist if present (production single-process mode)
  const distDir = path.resolve(process.cwd(), 'web/dist')
  if (existsSync(distDir)) {
    app.use(
      staticPlugin({
        assets: distDir,
        prefix: '/',
        indexHTML: true,
        alwaysStatic: false,
      })
    )
    const indexPath = path.join(distDir, 'index.html')
    if (existsSync(indexPath)) {
      const indexHtml = readFileSync(indexPath, 'utf8')
      app.get('*', ({ set }) => {
        if (set.headers) set.headers['content-type'] = 'text/html; charset=utf-8'
        return indexHtml
      })
    }
  }

  app
    .get('/api/health', () => ({ ok: true, ts: Date.now() }))
    .use(
      devicesRoutes(
        () => deps.registry,
        () => deps.cfg,
        () => deps.samples
      )
    )
    .use(samplesRoutes(() => deps.samples))
    .use(alarmsRoutes(() => deps.alarms))
    .use(controlRoutes(() => deps.registry))
    .use(piRoutes(() => deps.pi))
    .use(streamRoutes())
    .use(llmProviderRoutes(() => deps.llmProviders, () => deps.audit))
    .use(
      piAgentLLMRoutes(() => ({
        cfg: deps.cfg,
        registry: deps.registry,
        samples: deps.samples,
        alarms: deps.alarms,
        audit: deps.audit,
        agent: deps.pi,
        llmProviders: deps.llmProviders,
      }))
    )

  return app
}

export type App = ReturnType<typeof buildApp>