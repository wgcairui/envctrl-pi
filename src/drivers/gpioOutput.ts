import type { DriverConfig, Sample, SampleValue } from '../shared/types.js'
import type { BusRegistry } from '../iobus/types.js'
import { GpioBus } from '../iobus/gpioBus.js'

export class GpioOutputDriver {
  readonly id: string
  readonly kind: DriverConfig['kind']
  private pin: number
  private lastValue = false

  constructor(private cfg: DriverConfig, private buses: BusRegistry) {
    this.id = cfg.id
    this.kind = cfg.kind
    const pin = (cfg.driverOptions as { pin?: number }).pin
    if (pin === undefined) throw new Error(`gpio-out driver ${cfg.id}: driverOptions.pin required`)
    this.pin = pin
  }

  async init(): Promise<void> {
    /* GpioBus is registered on startup; nothing to do here */
  }
  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  async readPoints(): Promise<Sample[]> {
    const ts = Date.now()
    return this.cfg.points.map((p) => ({
      pointId: p.id,
      value: this.lastValue,
      quality: 'good' as const,
      ts,
    }))
  }

  async writePoint(pointId: string, value: SampleValue): Promise<void> {
    if (!this.cfg.points.find((p) => p.id === pointId)) {
      throw new Error(`Unknown point ${pointId}`)
    }
    const bus = this.buses.get(this.cfg.bus)
    if (!(bus instanceof GpioBus)) throw new Error(`Bus ${this.cfg.bus} is not a GpioBus`)
    const v = Boolean(value)
    bus.write(this.pin, v)
    this.lastValue = v
  }
}