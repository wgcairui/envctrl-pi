import { describe, it, expect, beforeEach } from 'vitest'
import { openDb } from '../../src/storage/db.js'
import { AlarmRepo } from '../../src/storage/repositories.js'
import { AlarmEngine } from '../../src/core/alarmEngine.js'
import { eventBus } from '../../src/core/eventBus.js'
import type { AppConfig } from '../../src/config/loader.js'
import { DeviceRegistry } from '../../src/core/deviceRegistry.js'
import { unlinkSync, existsSync } from 'node:fs'

describe('AlarmEngine', () => {
  let db: ReturnType<typeof openDb>
  let repo: AlarmRepo
  let registry: DeviceRegistry
  const cfg: AppConfig = {
    server: { host: '0.0.0.0', port: 3000 },
    storage: { path: './data/test.db' },
    serial: { ports: [] },
    tcp: { clients: [] },
    devices: [],
    pi: { configTxt: '/x', udevRulesDir: '/y', shimPath: '/z', services: [] },
    alarms: [
      {
        id: 'co2_high',
        source: 'sensor.point.co2',
        condition: 'value > 1000',
        severity: 'warning',
        actions: [],
        enabled: true,
      },
      {
        id: 'cpu_temp_high',
        source: 'pi.sensor.cpu_temp_c',
        condition: 'value > 70',
        severity: 'warning',
        actions: [],
        enabled: true,
      },
    ],
    schedules: [],
  }

  beforeEach(() => {
    eventBus.removeAllListeners()
    if (existsSync('./data/alarm_test.db')) unlinkSync('./data/alarm_test.db')
    db = openDb('./data/alarm_test.db')
    repo = new AlarmRepo(db)
    registry = new DeviceRegistry(cfg)
    void registry
  })

  it('triggers on threshold breach via sample event', () => {
    const eng = new AlarmEngine(cfg, repo, registry as any)
    eng.start()
    eventBus.emitEvent({
      type: 'sample',
      deviceId: 'sensor',
      samples: [{ pointId: 'co2', value: 1500, quality: 'good', ts: Date.now() }],
    })
    expect(repo.listActive().length).toBe(1)
    expect(repo.listActive()[0]?.ruleId).toBe('co2_high')
    eng.stop()
  })

  it('resolves on recovery', () => {
    const eng = new AlarmEngine(cfg, repo, registry as any)
    eng.start()
    eventBus.emitEvent({
      type: 'sample',
      deviceId: 'sensor',
      samples: [{ pointId: 'co2', value: 1500, quality: 'good', ts: 1 }],
    })
    eventBus.emitEvent({
      type: 'sample',
      deviceId: 'sensor',
      samples: [{ pointId: 'co2', value: 500, quality: 'good', ts: 2 }],
    })
    expect(repo.listActive().length).toBe(0)
    expect(repo.listRecent()[0]?.resolvedAt).toBeTypeOf('number')
    expect(repo.listRecent()[0]?.resolvedAt).toBeGreaterThan(0)
    eng.stop()
  })

  it('handles pi.cpu_temp event', () => {
    const eng = new AlarmEngine(cfg, repo, registry as any)
    eng.start()
    eventBus.emitEvent({ type: 'pi.cpu_temp', valueC: 80 })
    expect(repo.listActive().some((a) => a.ruleId === 'cpu_temp_high')).toBe(true)
    eng.stop()
  })
})