/**
 * IO Bus abstraction. A Driver gets its data plane through one of these.
 * Concrete implementations: SerialManager, GpioBus, TcpBus.
 */
export type BusKind = 'serial' | 'gpio' | 'tcp'

export interface IOBus {
  readonly id: string
  readonly kind: BusKind
  init(): Promise<void>
  close(): Promise<void>
}

export class BusRegistry {
  private buses = new Map<string, IOBus>()

  register(bus: IOBus): void {
    if (this.buses.has(bus.id)) {
      throw new Error(`Bus ${bus.id} already registered`)
    }
    this.buses.set(bus.id, bus)
  }

  get(id: string): IOBus {
    const b = this.buses.get(id)
    if (!b) throw new Error(`Bus ${id} not registered. Known: ${[...this.buses.keys()].join(', ')}`)
    return b
  }

  has(id: string): boolean {
    return this.buses.has(id)
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.buses.values()].map((b) => b.close().catch(() => undefined)))
    this.buses.clear()
  }
}