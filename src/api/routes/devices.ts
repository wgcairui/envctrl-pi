import { Elysia } from 'elysia'
import type { DeviceRegistry } from '../../core/deviceRegistry.js'
import type { AppConfig } from '../../config/loader.js'
import type { SampleRepo } from '../../storage/repositories.js'

export function devicesRoutes(reg: () => DeviceRegistry, cfg: () => AppConfig, samples: () => SampleRepo) {
  return new Elysia({ prefix: '/api' }).group('/devices', (app) =>
    app
      .get('/', ({ set }) => {
        const drivers = reg().list()
        return drivers.map((d) => {
          const dc = cfg().devices.find((x) => x.id === d.id)!
          return {
            id: d.id,
            name: dc.name ?? d.id,
            kind: d.kind,
            bus: dc.bus,
            config: dc,
            enabled: true,
            points: dc.points.map((p) => ({
              ...p,
              latest: samples().getLatest(d.id, p.id),
            })),
          }
        })
      })
      .get('/:id', ({ params, set }) => {
        const d = reg().get(params.id)
        if (!d) {
          set.status = 404
          return { message: 'device not found' }
        }
        const dc = cfg().devices.find((x) => x.id === d.id)!
        return {
          id: d.id,
          name: dc.name ?? d.id,
          kind: d.kind,
          bus: dc.bus,
          config: dc,
          points: dc.points.map((p) => ({
            ...p,
            latest: samples().getLatest(d.id, p.id),
          })),
        }
      })
  )
}