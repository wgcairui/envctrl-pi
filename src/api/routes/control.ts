import { Elysia, t } from 'elysia'
import { eventBus } from '../../core/eventBus.js'
import type { DeviceRegistry } from '../../core/deviceRegistry.js'
import type { SampleValue } from '../../shared/types.js'

export function controlRoutes(reg: () => DeviceRegistry) {
  return new Elysia({ prefix: '/api/control' }).post(
    '/',
    async ({ body, set }) => {
      const drv = reg().get(body.deviceId)
      if (!drv) {
        set.status = 404
        return { message: `device ${body.deviceId} not found` }
      }
      try {
        await drv.writePoint(body.pointId, body.value as SampleValue)
        eventBus.emitEvent({
          type: 'control',
          deviceId: body.deviceId,
          pointId: body.pointId,
          value: body.value as SampleValue,
        })
        return { ok: true }
      } catch (e) {
        set.status = 500
        return { message: (e as Error).message }
      }
    },
    {
      body: t.Object({
        deviceId: t.String(),
        pointId: t.String(),
        value: t.Union([t.Boolean(), t.Number(), t.String()]),
      }),
    }
  )
}