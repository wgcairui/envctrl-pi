import type { Database, Statement } from 'better-sqlite3'
import type { Sample, SampleValue, AlarmEvent, AlarmRule } from '../shared/types.js'

function jsonValue(v: SampleValue): string {
  return JSON.stringify(v)
}
function parseValue(s: string): SampleValue {
  return JSON.parse(s)
}

export class SampleRepo {
  private insertStmt: Statement
  private upsertLatestStmt: Statement
  private getLatestStmt: Statement
  private getHistoryStmt: Statement

  constructor(private db: Database) {
    this.insertStmt = db.prepare(
      `INSERT INTO sample (device_id, point_id, value, quality, ts) VALUES (?, ?, ?, ?, ?)`
    )
    this.upsertLatestStmt = db.prepare(
      `INSERT INTO point_latest (device_id, point_id, value, quality, ts)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(device_id, point_id) DO UPDATE SET
         value = excluded.value,
         quality = excluded.quality,
         ts = excluded.ts`
    )
    this.getLatestStmt = db.prepare(
      `SELECT device_id, point_id, value, quality, ts FROM point_latest
       WHERE device_id = ? AND point_id = ?`
    )
    this.getHistoryStmt = db.prepare(
      `SELECT device_id, point_id, value, quality, ts FROM sample
       WHERE device_id = ? AND point_id = ? AND ts >= ? AND ts <= ?
       ORDER BY ts ASC LIMIT ?`
    )
  }

  insertBatch(deviceId: string, samples: Sample[]): void {
    if (samples.length === 0) return
    const tx = this.db.transaction((items: Sample[]) => {
      for (const s of items) {
        const v = jsonValue(s.value)
        this.insertStmt.run(deviceId, s.pointId, v, s.quality, s.ts)
        this.upsertLatestStmt.run(deviceId, s.pointId, v, s.quality, s.ts)
      }
    })
    tx(samples)
  }

  getLatest(deviceId: string, pointId: string): Sample | null {
    const row = this.getLatestStmt.get(deviceId, pointId) as
      | { device_id: string; point_id: string; value: string; quality: Sample['quality']; ts: number }
      | undefined
    if (!row) return null
    return { pointId: row.point_id, value: parseValue(row.value), quality: row.quality, ts: row.ts }
  }

  getHistory(
    deviceId: string,
    pointId: string,
    fromTs: number,
    toTs: number,
    limit = 1000
  ): Sample[] {
    const rows = this.getHistoryStmt.all(deviceId, pointId, fromTs, toTs, limit) as Array<{
      device_id: string
      point_id: string
      value: string
      quality: Sample['quality']
      ts: number
    }>
    return rows.map((r) => ({
      pointId: r.point_id,
      value: parseValue(r.value),
      quality: r.quality,
      ts: r.ts,
    }))
  }
}

export class AlarmRepo {
  private insertEventStmt: Statement
  private resolveStmt: Statement
  private listActiveStmt: Statement
  private listRecentStmt: Statement
  private upsertRuleStmt: Statement
  private listRulesStmt: Statement

  constructor(private db: Database) {
    this.insertEventStmt = db.prepare(
      `INSERT INTO alarm (id, rule_id, device_id, point_id, value, severity, message, triggered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    this.resolveStmt = db.prepare(`UPDATE alarm SET resolved_at = ? WHERE id = ?`)
    this.listActiveStmt = db.prepare(
      `SELECT * FROM alarm WHERE resolved_at IS NULL ORDER BY triggered_at DESC LIMIT 100`
    )
    this.listRecentStmt = db.prepare(
      `SELECT * FROM alarm ORDER BY triggered_at DESC LIMIT ?`
    )
    this.upsertRuleStmt = db.prepare(
      `INSERT INTO alarm_rule (id, source, condition, severity, actions_json, enabled)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         source = excluded.source,
         condition = excluded.condition,
         severity = excluded.severity,
         actions_json = excluded.actions_json,
         enabled = excluded.enabled`
    )
    this.listRulesStmt = db.prepare(`SELECT * FROM alarm_rule`)
  }

  recordEvent(e: AlarmEvent): void {
    this.insertEventStmt.run(
      e.id,
      e.ruleId,
      e.deviceId ?? null,
      e.pointId ?? null,
      e.value !== undefined ? jsonValue(e.value) : null,
      e.severity,
      e.message,
      e.triggeredAt
    )
  }

  resolve(eventId: string, ts: number): void {
    this.resolveStmt.run(ts, eventId)
  }

  listActive(): AlarmEvent[] {
    return (this.listActiveStmt.all() as any[]).map(rowToEvent)
  }

  listRecent(limit = 100): AlarmEvent[] {
    return (this.listRecentStmt.all(limit) as any[]).map(rowToEvent)
  }

  upsertRule(r: AlarmRule): void {
    this.upsertRuleStmt.run(
      r.id,
      r.source,
      r.condition,
      r.severity,
      JSON.stringify(r.actions),
      r.enabled ? 1 : 0
    )
  }

  listRules(): AlarmRule[] {
    return (this.listRulesStmt.all() as any[]).map((r) => ({
      id: r.id,
      source: r.source,
      condition: r.condition,
      severity: r.severity,
      actions: JSON.parse(r.actions_json),
      enabled: !!r.enabled,
    }))
  }
}

function rowToEvent(r: any): AlarmEvent {
  return {
    id: r.id,
    ruleId: r.rule_id,
    deviceId: r.device_id ?? undefined,
    pointId: r.point_id ?? undefined,
    value: r.value ? parseValue(r.value) : undefined,
    severity: r.severity,
    message: r.message,
    triggeredAt: r.triggered_at,
    resolvedAt: r.resolved_at ?? undefined,
  }
}

export class AuditRepo {
  private stmt: Statement
  constructor(private db: Database) {
    this.stmt = db.prepare(`INSERT INTO audit (actor, action, detail_json, ts) VALUES (?, ?, ?, ?)`)
  }
  log(actor: string, action: string, detail?: unknown): void {
    this.stmt.run(actor, action, detail !== undefined ? JSON.stringify(detail) : null, Date.now())
  }
  /** Read recent audit entries, optionally filtered by actor. */
  recent(opts: { actor?: string; limit?: number } = {}): Array<{
    id: number; actor: string; action: string; detail_json: string; ts: number
  }> {
    const limit = opts.limit ?? 100
    if (opts.actor) {
      return this.db
        .prepare(`SELECT id, actor, action, detail_json, ts FROM audit WHERE actor = ? ORDER BY id DESC LIMIT ?`)
        .all(opts.actor, limit) as any
    }
    return this.db
      .prepare(`SELECT id, actor, action, detail_json, ts FROM audit ORDER BY id DESC LIMIT ?`)
      .all(limit) as any
  }
}