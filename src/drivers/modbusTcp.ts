import ModbusRTU from 'modbus-serial'
import type { DriverConfig, Sample, SampleValue } from '../shared/types.js'
import type { BusRegistry } from '../iobus/types.js'
import { parseTcpBusId } from '../iobus/tcpBus.js'

interface ModbusTcpOptions {
  slaveId: number
  registerType: 'input' | 'holding' | 'coil'
  registerAddr: number
  registerQty: number
}

export class ModbusTcpDriver {
  readonly id: string
  readonly kind: DriverConfig['kind']
  private client: ModbusRTU | null = null
  private opts: ModbusTcpOptions

  constructor(private cfg: DriverConfig, _buses: BusRegistry) {
    this.id = cfg.id
    this.kind = cfg.kind
    const o = cfg.driverOptions as Partial<ModbusTcpOptions>
    if (o.slaveId === undefined) throw new Error(`modbus-tcp driver ${cfg.id}: driverOptions.slaveId required`)
    this.opts = {
      slaveId: o.slaveId,
      registerType: o.registerType ?? 'input',
      registerAddr: o.registerAddr ?? 0,
      registerQty: o.registerQty ?? cfg.points.length,
    }
  }

  async init(): Promise<void> {
    const { host, port } = parseTcpBusId(this.cfg.bus)
    this.client = new ModbusRTU()
    await this.client.connectTCP(host, { port })
    this.client.setID(this.opts.slaveId)
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
    }
  }

  async readPoints(): Promise<Sample[]> {
    if (!this.client) throw new Error(`Driver ${this.id} not init'd`)
    const c = this.client
    const ts = Date.now()
    let values: number[] | boolean[]
    switch (this.opts.registerType) {
      case 'input': {
        const r = await c.readInputRegisters(this.opts.registerAddr, this.opts.registerQty)
        values = r.data as number[]
        break
      }
      case 'holding': {
        const r = await c.readHoldingRegisters(this.opts.registerAddr, this.opts.registerQty)
        values = r.data as number[]
        break
      }
      case 'coil': {
        const r = await c.readCoils(this.opts.registerAddr, this.opts.registerQty)
        values = r.data as boolean[]
        break
      }
    }
    return this.cfg.points.map((p, i) => {
      const raw = values[i]
      const scaled = typeof raw === 'number' ? this.scalePoint(p, raw) : Boolean(raw)
      return { pointId: p.id, value: scaled, quality: 'good' as const, ts }
    })
  }

  private scalePoint(p: { type: string; scale?: { gain: number; offset: number } }, raw: number): SampleValue {
    if (p.type === 'bool') return raw !== 0
    if (p.scale) return raw * p.scale.gain + p.scale.offset
    return raw
  }

  async writePoint(pointId: string, value: SampleValue): Promise<void> {
    if (!this.client) throw new Error(`Driver ${this.id} not init'd`)
    const idx = this.cfg.points.findIndex((p) => p.id === pointId)
    if (idx < 0) throw new Error(`Unknown point ${pointId}`)
    const addr = this.opts.registerAddr + idx
    if (typeof value === 'boolean') {
      await this.client.writeCoil(addr, value)
    } else {
      await this.client.writeRegister(addr, Number(value))
    }
  }
}