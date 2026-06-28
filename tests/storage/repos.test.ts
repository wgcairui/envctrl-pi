import { describe, it, expect, beforeEach } from 'vitest'
import { openDb } from '../../src/storage/db.js'
import { SampleRepo, AlarmRepo, AuditRepo } from '../../src/storage/repositories.js'
import { unlinkSync, existsSync } from 'node:fs'

describe('storage', () => {
  let db: ReturnType<typeof openDb>
  let samples: SampleRepo
  let alarms: AlarmRepo
  let audit: AuditRepo

  beforeEach(() => {
    if (existsSync('./data/test.db')) unlinkSync('./data/test.db')
    db = openDb('./data/test.db')
    samples = new SampleRepo(db)
    alarms = new AlarmRepo(db)
    audit = new AuditRepo(db)
  })

  it('inserts and reads latest', () => {
    samples.insertBatch('d1', [
      { pointId: 'temp', value: 21.5, quality: 'good', ts: 1000 },
      { pointId: 'temp', value: 22.1, quality: 'good', ts: 2000 },
    ])
    const latest = samples.getLatest('d1', 'temp')
    expect(latest?.value).toBe(22.1)
    expect(latest?.ts).toBe(2000)
  })

  it('reads history bounded by ts range', () => {
    for (let i = 0; i < 5; i++) {
      samples.insertBatch('d1', [
        { pointId: 'temp', value: i, quality: 'good', ts: 1000 + i * 1000 },
      ])
    }
    const hist = samples.getHistory('d1', 'temp', 1500, 4500, 10)
    expect(hist.length).toBe(3)
    expect(hist[0]?.value).toBe(1)
    expect(hist[2]?.value).toBe(3)
  })

  it('records and resolves alarms', () => {
    const evt = {
      id: 'a1',
      ruleId: 'r1',
      deviceId: 'd1',
      pointId: 'temp',
      value: 99,
      severity: 'warning' as const,
      message: 'too hot',
      triggeredAt: 1000,
    }
    alarms.recordEvent(evt)
    expect(alarms.listActive().length).toBe(1)
    alarms.resolve('a1', 2000)
    expect(alarms.listActive().length).toBe(0)
    expect(alarms.listRecent()[0]?.resolvedAt).toBe(2000)
  })

  it('upserts alarm rules', () => {
    alarms.upsertRule({
      id: 'r1',
      source: 'd1.point.temp',
      condition: 'value > 50',
      severity: 'warning',
      actions: [{ type: 'notify.sse' }],
      enabled: true,
    })
    alarms.upsertRule({
      id: 'r1',
      source: 'd1.point.temp',
      condition: 'value > 60',
      severity: 'error',
      actions: [],
      enabled: false,
    })
    const rules = alarms.listRules()
    expect(rules.length).toBe(1)
    expect(rules[0]?.condition).toBe('value > 60')
    expect(rules[0]?.enabled).toBe(false)
  })

  it('logs audit entries', () => {
    audit.log('system', 'startup', { foo: 'bar' })
    audit.log('user', 'control', { deviceId: 'd1' })
    const row = db.prepare('SELECT COUNT(*) as c FROM audit').get() as { c: number }
    expect(row.c).toBe(2)
  })
})