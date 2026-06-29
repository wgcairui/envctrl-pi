import { Elysia } from 'elysia'
import { node } from '@elysiajs/node'
import cors from '@elysiajs/cors'
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
  return (
    new Elysia({ adapter: node() })
      .use(cors())
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
  )
}

export type App = ReturnType<typeof buildApp>