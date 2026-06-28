import { readFileSync, existsSync } from 'node:fs'
import type { PiInfo } from '../shared/types.js'
import type { PiBroker } from './broker.js'

export class SysInfo {
  constructor(private broker: PiBroker) {}

  /** Collect system info. Tries broker for vcgencmd; falls back to /proc on dev. */
  async collect(): Promise<PiInfo> {
    const [model, tempC, volts] = await Promise.all([
      this.readModel(),
      this.readCpuTemp().catch(() => undefined),
      this.readCpuVolts().catch(() => undefined),
    ])
    return {
      model,
      cpuTempC: tempC,
      cpuVolts: volts,
      uptimeSec: this.readUptime(),
      loadAvg: this.readLoadAvg(),
      memory: this.readMemory(),
      disk: this.readDisk(),
    }
  }

  private async readModel(): Promise<string> {
    try {
      const cpuinfo = readFileSync('/proc/cpuinfo', 'utf8')
      const m = /^Model\s*:\s*(.+)$/m.exec(cpuinfo)
      return m?.[1]?.trim() ?? 'unknown'
    } catch {
      return 'unknown'
    }
  }

  private async readCpuTemp(): Promise<number> {
    if (!existsSync('/sys/class/thermal/thermal_zone0/temp')) throw new Error('no thermal zone')
    const raw = readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8').trim()
    return Number(raw) / 1000
  }

  private async readCpuVolts(): Promise<number> {
    const r = await this.broker.call<string>('vcgencmd', { args: ['measure_volts'] })
    const m = /volt=(\S+)/.exec(r)
    return m ? Number(m[1]) : 0
  }

  private readUptime(): number {
    try {
      return Math.floor(Number(readFileSync('/proc/uptime', 'utf8').split(' ')[0]))
    } catch {
      return 0
    }
  }

  private readLoadAvg(): [number, number, number] {
    try {
      const parts = readFileSync('/proc/loadavg', 'utf8').split(' ').slice(0, 3)
      return [Number(parts[0]), Number(parts[1]), Number(parts[2])] as [number, number, number]
    } catch {
      return [0, 0, 0]
    }
  }

  private readMemory(): { totalMb: number; freeMb: number } {
    try {
      const lines = readFileSync('/proc/meminfo', 'utf8').split('\n')
      const mem: Record<string, number> = {}
      for (const l of lines) {
        const m = /^(\w+):\s+(\d+)/.exec(l)
        if (m) mem[m[1]!] = Number(m[2])
      }
      return { totalMb: Math.round((mem.MemTotal ?? 0) / 1024), freeMb: Math.round((mem.MemAvailable ?? 0) / 1024) }
    } catch {
      return { totalMb: 0, freeMb: 0 }
    }
  }

  private readDisk(): { totalGb: number; freeGb: number } {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { statfsSync } = require('node:fs')
      const s = statfsSync('/')
      const totalGb = Math.round((s.blocks * s.bsize) / 1024 / 1024 / 1024)
      const freeGb = Math.round((s.bfree * s.bsize) / 1024 / 1024 / 1024)
      return { totalGb, freeGb }
    } catch {
      return { totalGb: 0, freeGb: 0 }
    }
  }
}