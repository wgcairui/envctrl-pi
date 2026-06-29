import { Elysia } from 'elysia'
import { node } from '@elysiajs/node'
import cors from '@elysiajs/cors'
import { staticPlugin } from '@elysiajs/static'
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

export interface Deps {
  cfg: AppConfig
  registry: DeviceRegistry
  samples: SampleRepo
  alarms: AlarmRepo
  pi: PiAgent
}

/**
 * Build the Elysia app. Does NOT call .listen() — caller is responsible.
 * Exporting this as the type source for Eden end-to-end types.
 */
export function buildApp(deps: Deps) {
  const app = new Elysia({ adapter: node() }).use(cors())

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
    // SPA fallback: serve index.html for any non-/api GET that didn't match
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

  return app
}

export type App = ReturnType<typeof buildApp>