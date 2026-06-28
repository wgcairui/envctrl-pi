// Core domain types shared between server and web (consumed via Eden end-to-end types).

export type PointType = 'number' | 'bool' | 'enum'
export type Access = 'ro' | 'wo' | 'rw'

export interface Point {
  id: string
  name: string
  type: PointType
  access: Access
  unit?: string
  /** Linear transform: engineering = raw * gain + offset */
  scale?: { gain: number; offset: number }
  /** For type === 'enum' */
  enumValues?: Record<string, string>
  alarmHi?: number
  alarmLo?: number
}

export type DeviceKind =
  | 'modbus-rtu'
  | 'modbus-tcp'
  | 'gpio-out'
  | 'gpio-in'
  | 'custom'

export interface DriverConfig {
  id: string
  name?: string
  kind: DeviceKind
  bus: string
  pollMs?: number
  points: Point[]
  /** Free-form driver-specific options (slaveId, pin, registerAddr, ...). */
  driverOptions: Record<string, unknown>
}

export type SampleValue = number | boolean | string

export interface Sample {
  pointId: string
  value: SampleValue
  quality: 'good' | 'bad' | 'uncertain'
  /** ms epoch */
  ts: number
}

export interface Device {
  id: string
  name: string
  kind: DeviceKind
  bus: string
  config: DriverConfig
  enabled: boolean
}

export type AlarmSeverity = 'info' | 'warning' | 'error' | 'critical'

export type AlarmAction =
  | { type: 'device.write'; target: string; value: SampleValue }
  | { type: 'notify.sse' }

export interface AlarmRule {
  id: string
  /** `<deviceId>.point.<pointId>` or `pi.sensor.cpu_temp_c` or `pi.event.serial_closed` */
  source: string
  /** Token-whitelisted expression, e.g. 'value > 1000', "value === 'high'", 'true' */
  condition: string
  severity: AlarmSeverity
  actions: AlarmAction[]
  enabled: boolean
}

export interface AlarmEvent {
  id: string
  ruleId: string
  deviceId?: string
  pointId?: string
  value?: SampleValue
  severity: AlarmSeverity
  message: string
  triggeredAt: number
  resolvedAt?: number
}

/** Pi Agent system info exposed to web */
export interface PiInfo {
  model: string
  cpuTempC?: number
  cpuVolts?: number
  uptimeSec: number
  loadAvg: [number, number, number]
  memory: { totalMb: number; freeMb: number }
  disk: { totalGb: number; freeGb: number }
}

export interface OverlayInfo {
  name: string
  loaded: boolean
  /** GPIOs occupied by this overlay, if any */
  gpios?: number[]
}

export interface UdevRule {
  matchVendor?: string
  matchProduct?: string
  matchSerial?: string
  symlink: string
}

/** EventBus event payloads */
export type BusEvent =
  | { type: 'sample'; deviceId: string; samples: Sample[] }
  | { type: 'alarm'; event: AlarmEvent }
  | { type: 'device.state'; deviceId: string; state: 'online' | 'offline' | 'error'; detail?: string }
  | { type: 'pi.serial_closed'; path: string }
  | { type: 'pi.error'; severity: AlarmSeverity; source: string; message: string }
  | { type: 'pi.cpu_temp'; valueC: number }
  | { type: 'control'; deviceId: string; pointId: string; value: SampleValue }