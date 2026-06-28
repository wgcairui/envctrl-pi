import { describe, it, expect } from 'vitest'
import type { Point, DriverConfig, AlarmRule } from '../../src/shared/types.js'

describe('shared types', () => {
  it('constructs a Point', () => {
    const p: Point = {
      id: 'co2',
      name: 'CO2',
      type: 'number',
      access: 'ro',
      unit: 'ppm',
      scale: { gain: 1, offset: 0 },
      alarmHi: 1000,
    }
    expect(p.type).toBe('number')
    expect(p.alarmHi).toBe(1000)
  })

  it('constructs a DriverConfig', () => {
    const cfg: DriverConfig = {
      id: 'co2_sensor',
      kind: 'modbus-rtu',
      bus: 'bus1',
      pollMs: 5000,
      points: [],
      driverOptions: { slaveId: 1 },
    }
    expect(cfg.kind).toBe('modbus-rtu')
  })

  it('constructs an AlarmRule', () => {
    const r: AlarmRule = {
      id: 'co2_high',
      source: 'co2_sensor.point.co2',
      condition: 'value > 1000',
      severity: 'warning',
      actions: [{ type: 'notify.sse' }],
      enabled: true,
    }
    expect(r.actions[0]?.type).toBe('notify.sse')
  })
})