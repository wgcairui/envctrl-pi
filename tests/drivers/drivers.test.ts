import { describe, it, expect, beforeEach } from 'vitest'
import { applyScale } from '../../src/drivers/driver.js'
import { BusRegistry } from '../../src/iobus/types.js'
import { GpioBus } from '../../src/iobus/gpioBus.js'
import { GpioOutputDriver } from '../../src/drivers/gpioOutput.js'
import { GpioInputDriver } from '../../src/drivers/gpioInput.js'
import type { DriverConfig } from '../../src/shared/types.js'

describe('applyScale', () => {
  it('returns raw when no scale', () => expect(applyScale(42)).toBe(42))
  it('applies gain and offset', () =>
    expect(applyScale(100, { gain: 0.1, offset: -5 })).toBeCloseTo(5))
})

describe('GpioOutputDriver', () => {
  it('writes and reads back current value', async () => {
    const reg = new BusRegistry()
    const bus = new GpioBus()
    await bus.init()
    reg.register(bus)
    const cfg: DriverConfig = {
      id: 'led',
      kind: 'gpio-out',
      bus: 'gpio',
      driverOptions: { pin: 17 },
      points: [{ id: 'state', name: 'State', type: 'bool', access: 'rw' }],
    }
    const d = new GpioOutputDriver(cfg, reg)
    await d.init()
    await d.writePoint('state', true)
    const samples = await d.readPoints()
    expect(samples[0]?.value).toBe(true)
  })
})

describe('GpioInputDriver', () => {
  it('rejects writePoint', async () => {
    const reg = new BusRegistry()
    const bus = new GpioBus()
    await bus.init()
    reg.register(bus)
    const cfg: DriverConfig = {
      id: 'door',
      kind: 'gpio-in',
      bus: 'gpio',
      driverOptions: { pin: 27, edge: 'both' },
      points: [{ id: 'open', name: 'Open', type: 'bool', access: 'ro' }],
    }
    const d = new GpioInputDriver(cfg, reg)
    await d.init()
    await d.start()
    await expect(d.writePoint('open', true)).rejects.toThrow(/not writable/)
    await d.stop()
  })
})