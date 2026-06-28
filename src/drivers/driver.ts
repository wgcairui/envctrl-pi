import type { DriverConfig, Sample, SampleValue } from '../shared/types.js'
import type { BusRegistry } from '../iobus/types.js'

/**
 * Driver — translates a physical device into our domain Sample/Point model.
 * Drivers are constructed by `createDriver` based on `config.kind`.
 */
export interface Driver {
  readonly id: string
  readonly kind: DriverConfig['kind']
  init(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  readPoints(): Promise<Sample[]>
  writePoint(pointId: string, value: SampleValue): Promise<void>
}

import { ModbusRtuDriver } from './modbusRtu.js'
import { ModbusTcpDriver } from './modbusTcp.js'
import { GpioOutputDriver } from './gpioOutput.js'
import { GpioInputDriver } from './gpioInput.js'

export function createDriver(config: DriverConfig, buses: BusRegistry): Driver {
  switch (config.kind) {
    case 'modbus-rtu':
      return new ModbusRtuDriver(config, buses)
    case 'modbus-tcp':
      return new ModbusTcpDriver(config, buses)
    case 'gpio-out':
      return new GpioOutputDriver(config, buses)
    case 'gpio-in':
      return new GpioInputDriver(config, buses)
    default:
      throw new Error(`Unsupported driver kind: ${config.kind}`)
  }
}

/**
 * Apply scale transform: engineering = raw * gain + offset.
 * Used by drivers that read raw integer registers.
 */
export function applyScale(raw: number, scale?: { gain: number; offset: number }): number {
  if (!scale) return raw
  return raw * scale.gain + scale.offset
}