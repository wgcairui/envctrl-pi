import { Elysia, t } from 'elysia'
import type { PiAgent } from '../../pi/agent.js'

export function piRoutes(agent: () => PiAgent) {
  const app = new Elysia({ prefix: '/api/pi' })

  app.get('/info', async () => {
    try {
      return await agent().sysInfo.collect()
    } catch (e) {
      return { error: (e as Error).message }
    }
  })

  app.get('/overlays', () => agent().getOverlays())

  app.get('/devices', async () => {
    try {
      const [serial, gpiochip] = await Promise.all([
        agent()
          .broker.call<{ devices: string[] }>('list-serial')
          .catch(() => ({ devices: [] as string[] })),
        agent()
          .broker.call<{ devices: string[] }>('list-gpiochip')
          .catch(() => ({ devices: [] as string[] })),
      ])
      return { serial: serial.devices, gpiochip: gpiochip.devices }
    } catch (e) {
      return { error: (e as Error).message }
    }
  })

  app.get('/logs', async ({ query }) => {
    try {
      const unit = (query as any).unit ?? 'envctrl'
      const lines = Number((query as any).lines ?? 100)
      const r = await agent().broker.call<{ output: string }>('journalctl', { unit, lines })
      return { output: r.output }
    } catch (e) {
      return { error: (e as Error).message }
    }
  })

  app.post(
    '/config',
    async ({ body, set }) => {
      try {
        if (body.dryRun !== false) {
          return agent().planConfigChange(body)
        }
        return agent().applyConfigChange(body)
      } catch (e) {
        set.status = 400
        return { message: (e as Error).message }
      }
    },
    {
      body: t.Object({
        toAdd: t.Array(t.String()),
        toRemove: t.Array(t.String()),
        dryRun: t.Optional(t.Boolean()),
      }),
    }
  )

  return app
}