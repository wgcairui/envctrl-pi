import { describe, it, expect } from 'vitest'
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

  it('parses point.display for UI category hints', () => {
    const cfg = loadConfig('./config/default.yaml')
    const co2 = cfg.devices.find((d) => d.id === 'indoor_co2')!
    const co2point = co2.points.find((p) => p.id === 'co2_ppm')!
    expect(co2point.display?.category).toBe('co2')
    expect(co2point.display?.icon).toBe('wind')
    expect(co2point.display?.featured).toBe(true)
  })

  it('parses device.position for RoomMap layout', () => {
    const cfg = loadConfig('./config/default.yaml')
    const indoor = cfg.devices.find((d) => d.id === 'indoor_co2')!
    expect(indoor.position).toBeDefined()
    expect(indoor.position?.x).toBe(50)
    expect(indoor.position?.y).toBe(45)
    expect(indoor.position?.room).toBe('living')
  })

  it('accepts device without display/position (back-compat)', () => {
    const yaml = `
server: { host: 0.0.0.0, port: 3000 }
storage: { path: ./data/db.sqlite }
serial: { ports: [] }
devices:
  - id: legacy
    kind: gpio-in
    bus: gpio
    driverOptions: { pin: 17 }
    points:
      - { id: s, name: state, type: bool, access: ro }
pi: { configTxt: /a, udevRulesDir: /b, shimPath: /c, services: [] }
`
    const cfg = parseConfigString(yaml)
    const dev = cfg.devices[0]!
    expect(dev.position).toBeUndefined()
    expect(dev.points[0]!.display).toBeUndefined()
  })

  it('rejects invalid point.display.category', () => {
    expect(() =>
      parseConfigString(`
server: { host: 0.0.0.0, port: 3000 }
storage: { path: ./data/db.sqlite }
serial: { ports: [] }
devices:
  - id: x
    kind: gpio-in
    bus: gpio
    driverOptions: {}
    points:
      - { id: s, name: state, type: number, access: ro, display: { category: invalid } }
pi: { configTxt: /a, udevRulesDir: /b, shimPath: /c, services: [] }
`)
    ).toThrow(/category|Invalid enum value/)
  })
})