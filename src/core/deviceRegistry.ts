import type { AppConfig } from '../config/loader.js'
import { createDriver, type Driver } from '../drivers/driver.js'
import { BusRegistry } from '../iobus/types.js'
import { GpioBus } from '../iobus/gpioBus.js'
import { SerialBus } from '../iobus/serialManager.js'

export class DeviceRegistry {
  private drivers = new Map<string, Driver>()
  readonly buses: BusRegistry

  constructor(private cfg: AppConfig) {
    this.buses = new BusRegistry()
  }

  async init(): Promise<void> {
    // Register serial buses
    for (const p of this.cfg.serial.ports) {
      const bus = new SerialBus(p)
      this.buses.register(bus)
      try {
        await bus.init()
      } catch (e) {
        console.warn(`[DeviceRegistry] serial bus ${p.id} init failed:`, (e as Error).message)
      }
    }
    // Register GPIO bus (singleton)
    const gpio = new GpioBus()
    await gpio.init()
    this.buses.register(gpio)
    // Build drivers
    for (const dc of this.cfg.devices) {
      try {
        const d = createDriver(dc, this.buses)
        await d.init()
        if (d.kind === 'gpio-in') await d.start()
        this.drivers.set(d.id, d)
      } catch (e) {
        console.warn(`[DeviceRegistry] driver ${dc.id} init failed:`, (e as Error).message)
      }
    }
  }

  get(id: string): Driver | undefined {
    return this.drivers.get(id)
  }

  list(): Driver[] {
    return [...this.drivers.values()]
  }

  async stopAll(): Promise<void> {
    for (const d of this.drivers.values()) {
      await d.stop().catch(() => undefined)
    }
    await this.buses.closeAll()
  }
}