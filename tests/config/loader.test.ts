import { describe, it, expect } from 'bun:test'
import { loadConfig, parseConfigString, ConfigSchema } from '../../src/config/loader.js'

describe('config loader', () => {
  it('loads default.yaml', () => {
    const cfg = loadConfig('./config/default.yaml')
    expect(cfg.server.port).toBe(3000)
    expect(cfg.serial.ports.length).toBeGreaterThan(0)
    expect(cfg.devices.length).toBeGreaterThan(0)
    expect(cfg.devices.map((d) => d.id)).toContain('indoor_co2')
  })

  it('parses alarm rule with device.write action', () => {
    const cfg = loadConfig('./config/default.yaml')
    const co2 = cfg.alarms.find((a) => a.id === 'co2_high')
    expect(co2).toBeDefined()
    expect(co2?.severity).toBe('warning')
    expect(co2?.actions[0]?.type).toBe('device.write')
  })

  it('rejects invalid server.port', () => {
    const yaml = `
server: { host: 0.0.0.0, port: "abc" }
storage: { path: ./x.db }
serial: { ports: [] }
devices: []
pi: { configTxt: /x, udevRulesDir: /y, shimPath: /z, services: [] }
`
    expect(() => parseConfigString(yaml)).toThrow()
  })

  it('accepts a minimal valid config', () => {
    const yaml = `
server: { host: 0.0.0.0, port: 3000 }
storage: { path: ./data/db.sqlite }
serial: { ports: [] }
devices: []
pi: { configTxt: /a, udevRulesDir: /b, shimPath: /c, services: [] }
`
    const cfg = parseConfigString(yaml)
    expect(cfg.alarms).toEqual([])
    expect(cfg.schedules).toEqual([])
  })

  it('rejects unknown driver kind', () => {
    const cfg = ConfigSchema.shape.devices
    expect(() =>
      cfg.parse([
        {
          id: 'x',
          kind: 'invalid-kind' as never,
          bus: 'b',
          points: [],
          driverOptions: {},
        },
      ])
    ).toThrow()
  })
})