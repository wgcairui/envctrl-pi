import { Elysia } from 'elysia'
import type { DeviceRegistry } from '../../core/deviceRegistry.js'
import type { AppConfig } from '../../config/loader.js'
import type { SampleRepo } from '../../storage/repositories.js'

export function devicesRoutes(reg: () => DeviceRegistry, cfg: () => AppConfig, samples: () => SampleRepo) {
  /**
   * Shape the device response: id, name, kind, bus, config, position, points
   *
   * `position` is read from the device's `DriverConfig` (we add it there so
   * YAML configuration stays single-source-of-truth).
   * `display` on each point is preserved as-is from the YAML.
   */
  function shape(d: { id: string; kind: string }, dc: NonNullable<ReturnType<AppConfig['devices']['find']>>) {
    return {
      id: d.id,
      name: dc.name ?? d.id,
      kind: d.kind,
      bus: dc.bus,
      position: dc.position,
      config: dc,
      enabled: true,
      points: dc.points.map((p) => ({
        ...p,
        latest: samples().getLatest(d.id, p.id),
      })),
    }
  }

  return new Elysia({ prefix: '/api' }).group('/devices', (app) =>
    app
      .get('/', ({ set }) => {
        const drivers = reg().list()
        return drivers.map((d) => {
          const dc = cfg().devices.find((x) => x.id === d.id)!
          return shape(d, dc)
        })
      })
      .get('/:id', ({ params, set }) => {
        const d = reg().get(params.id)
        if (!d) {
          set.status = 404
          return { message: 'device not found' }
        }
        const dc = cfg().devices.find((x) => x.id === d.id)!
        return shape(d, dc)
      })
  )
}