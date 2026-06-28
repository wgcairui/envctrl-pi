import type { DriverConfig, Sample, SampleValue } from '../shared/types.js'
import type { BusRegistry } from '../iobus/types.js'
import { GpioBus, type GpioEdge } from '../iobus/gpioBus.js'

export class GpioInputDriver {
  readonly id: string
  readonly kind: DriverConfig['kind']
  private pin: number
  private edge: GpioEdge
  private debounceMs: number
  private stopWatch: (() => void) | null = null
  private currentValue = false
  private listeners: ((s: Sample[]) => void)[] = []

  constructor(private cfg: DriverConfig, private buses: BusRegistry) {
    this.id = cfg.id
    this.kind = cfg.kind
    const opts = cfg.driverOptions as { pin?: number; edge?: GpioEdge; debounceMs?: number }
    if (opts.pin === undefined) throw new Error(`gpio-in driver ${cfg.id}: driverOptions.pin required`)
    this.pin = opts.pin
    this.edge = opts.edge ?? 'both'
    this.debounceMs = opts.debounceMs ?? 50
  }

  async init(): Promise<void> {}

  async start(): Promise<void> {
    const bus = this.buses.get(this.cfg.bus)
    if (!(bus instanceof GpioBus)) throw new Error(`Bus ${this.cfg.bus} is not a GpioBus`)
    this.stopWatch = bus.watch(this.pin, this.edge, (v) => {
      this.currentValue = v
      const ts = Date.now()
      const samples: Sample[] = this.cfg.points.map((p) => ({
        pointId: p.id,
        value: v,
        quality: 'good' as const,
        ts,
      }))
      for (const l of this.listeners) l(samples)
    }, this.debounceMs)
  }

  async stop(): Promise<void> {
    this.stopWatch?.()
    this.stopWatch = null
  }

  onChange(fn: (samples: Sample[]) => void): void {
    this.listeners.push(fn)
  }

  async readPoints(): Promise<Sample[]> {
    const ts = Date.now()
    return this.cfg.points.map((p) => ({
      pointId: p.id,
      value: this.currentValue,
      quality: 'good' as const,
      ts,
    }))
  }

  async writePoint(_pointId: string, _value: SampleValue): Promise<void> {
    throw new Error(`gpio-in driver ${this.id}: not writable`)
  }
}