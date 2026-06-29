import { Elysia, t } from 'elysia'
import type { AlarmRepo } from '../../storage/repositories.js'

export function alarmsRoutes(alarms: () => AlarmRepo) {
  return new Elysia({ prefix: '/api/alarms' }).get('/', ({ query }) => {
    if (query.active === 'true') return alarms().listActive()
    const limit = Number(query.limit ?? 100)
    return alarms().listRecent(limit)
  })
}