import { Elysia, t } from 'elysia'
import type { SampleRepo } from '../../storage/repositories.js'

export function samplesRoutes(samples: () => SampleRepo) {
  return new Elysia({ prefix: '/api' }).group('/samples', (app) =>
    app
      .get(
        '/:deviceId/:pointId',
        ({ params, query }) => {
          const to = Number(query.to ?? Date.now())
          const from = Number(query.from ?? to - 3600_000)
          const limit = Number(query.limit ?? 1000)
          return samples().getHistory(params.deviceId, params.pointId, from, to, limit)
        },
        {
          query: t.Object({
            from: t.Optional(t.String()),
            to: t.Optional(t.String()),
            limit: t.Optional(t.String()),
          }),
        }
      )
  )
}