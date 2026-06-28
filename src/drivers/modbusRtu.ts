import ModbusRTU from 'modbus-serial'
import type { Driver, Driver as IDriver } from './driver.js'
import type { DriverConfig, Sample, SampleValue } from '../shared/types.js'
import type { BusRegistry } from '../iobus/types.js'

interface ModbusRtuOptions {
  slaveId: number
  registerType: 'input' | 'holding' | 'coil'
  registerAddr: number
  registerQty: number
}

export class ModbusRtuDriver implements IDriver {
  readonly id: string
  readonly kind: DriverConfig['kind']
  private client: ModbusRTU | null = null
  private opts: ModbusRtuOptions

  constructor(private cfg: DriverConfig, private buses: BusRegistry) {
    this.id = cfg.id
    this.kind = cfg.kind
    const o = cfg.driverOptions as Partial<ModbusRtuOptions>
    if (o.slaveId === undefined) throw new Error(`modbus-rtu driver ${cfg.id}: driverOptions.slaveId required`)
    this.opts = {
      slaveId: o.slaveId,
      registerType: o.registerType ?? 'input',
      registerAddr: o.registerAddr ?? 0,
      registerQty: o.registerQty ?? cfg.points.length,
    }
  }

  async init(): Promise<void> {
    const bus = this.buses.get(this.cfg.bus)
    if (bus.kind !== 'serial') throw new Error(`Bus ${this.cfg.bus} is not serial`)
    this.client = new ModbusRTU()
    // Use modbus-serial's connectRTU with the path; modbus-serial opens its own SerialPort
    const path = (bus as any).cfg?.path as string
    const baudRate = (bus as any).cfg?.baudRate as number
    await this.client.connectRTUBuffered(path, { baudRate, parity: 'none', dataBits: 8, stopBits: 1 })
    this.client.setID(this.opts.slaveId)
  }

  async start(): Promise<void> {
    /* nothing periodic to start — DataEngine drives polling */
  }

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