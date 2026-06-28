import { eventBus } from '../core/eventBus.js'
import { PiBroker } from './broker.js'
import { SysInfo } from './sysInfo.js'
import {
  parseConfigTxt,
  readConfig,
  applyConfigChange,
  writeConfigWithBackup,
  conflictsWith,
  ALLOWED_OVERLAYS,
  occupiedGpio,
} from './configOps.js'

export interface PiConfigRequest {
  toAdd: string[]
  toRemove: string[]
  dryRun?: boolean
}

export interface PiConfigResponse {
  dryRun: boolean
  toAdd: string[]
  toRemove: string[]
  conflicts: number[]
  currentOverlays: { name: string; deviceNode?: string; occupiedGpio?: number[] }[]
  proposedContent?: string
  backup?: string
}

/**
 * PiAgent — façade over Pi system introspection and configuration.
 * Exposes pure functions where possible (configOps) and broker-mediated
 * actions (systemctl, reboot) where root is required.
 *
 * On a non-Pi dev box, reads /proc directly and refuses privileged calls.
 */
export class PiAgent {
  readonly broker: PiBroker
  readonly sysInfo: SysInfo

  constructor(private configTxtPath: string, shimPath?: string) {
    this.broker = new PiBroker({ shimPath })
    this.sysInfo = new SysInfo(this.broker)
  }

  /** Read the current /boot config.txt, parse overlays */
  getOverlays() {
    const text = readConfig(this.configTxtPath)
    return parseConfigTxt(text)
  }

  /** Compute a proposed change without writing anything. */
  planConfigChange(req: PiConfigRequest): PiConfigResponse {
    const current = this.getOverlays()
    const currentNames = new Set(current.map((o) => o.name))

    for (const add of req.toAdd) {
      const stripped = add.replace(/^dtoverlay=/, '').replace(/^enable_/, '')
      if (!ALLOWED_OVERLAYS.has(add) && !ALLOWED_OVERLAYS.has(`dtoverlay=${stripped}`) && !ALLOWED_OVERLAYS.has(`enable_${stripped}`)) {
        throw new Error(`Overlay not allowed: ${add}`)
      }
      const conflict = conflictsWith(stripped, current)
      if (conflict.length > 0 && !req.toRemove.includes(stripped)) {
        throw new Error(`Overlay ${stripped} conflicts with GPIO ${conflict.join(', ')}`)
      }
    }

    const text = readConfig(this.configTxtPath)
    const proposed = applyConfigChange(text, { toAdd: req.toAdd, toRemove: req.toRemove })

    return {
      dryRun: req.dryRun !== false,
      toAdd: req.toAdd,
      toRemove: req.toRemove,
      conflicts: occupiedGpio(current),
      currentOverlays: current.map((o) => ({ name: o.name, deviceNode: o.deviceNode, occupiedGpio: o.occupiedGpio })),
      proposedContent: proposed,
    }
  }

  /** Apply a previously-planned change (writes to disk with backup). */
  applyConfigChange(req: PiConfigRequest): PiConfigResponse {
    const plan = this.planConfigChange({ ...req, dryRun: true })
    const { backup } = writeConfigWithBackup(this.configTxtPath, plan.proposedContent!)
    return { ...plan, dryRun: false, backup }
  }

  /** Periodic task: poll CPU temp and emit event. */
  startTemperatureMonitor(intervalMs = 5000): NodeJS.Timeout {
    return setInterval(async () => {
      try {
        const info = await this.sysInfo.collect()
        if (info.cpuTempC !== undefined) {
          eventBus.emitEvent({ type: 'pi.cpu_temp', valueC: info.cpuTempC })
        }
      } catch {
        /* swallow */
      }
    }, intervalMs)
  }

  /** Generate udev rules file content. */
  renderUdevRules(rules: import('../shared/types.js').UdevRule[]): string {
    const lines = rules.map((r, i) => {
      const filters: string[] = []
      if (r.matchVendor) filters.push(`ATTRS{idVendor}=="${r.matchVendor}"`)
      if (r.matchProduct) filters.push(`ATTRS{idProduct}=="${r.matchProduct}"`)
      if (r.matchSerial) filters.push(`ATTRS{serial}=="${r.matchSerial}"`)
      return `# envctrl rule ${i + 1}\nSUBSYSTEM=="tty", ${filters.join(', ')}, SYMLINK+="${r.symlink}", MODE="0660", GROUP="dialout"`
    })
    return lines.join('\n') + '\n'
  }
}