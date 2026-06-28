import { randomUUID } from 'node:crypto'
import type { AppConfig } from '../config/loader.js'
import type { AlarmRule, AlarmEvent, BusEvent } from '../shared/types.js'
import { eventBus } from './eventBus.js'
import { compileCondition } from './conditionParser.js'
import { AlarmRepo } from '../storage/repositories.js'
import type { DeviceRegistry } from './deviceRegistry.js'

interface CompiledRule {
  rule: AlarmRule
  /** deviceId from rule.source, or undefined for pi.* sources */
  deviceId?: string
  pointId?: string
  /** compiled predicate */
  pred: (value: unknown) => boolean
  /** active alarm event id, if currently in triggered state */
  activeId?: string
}

/**
 * AlarmEngine — subscribes to event bus and evaluates alarm rules against
 * samples and pi events. Maintains triggered/resolved state per rule.
 *
 * Action execution (device.write, notify.sse) is delegated to a callback
 * supplied at construction; the engine itself doesn't know about drivers,
 * keeping the dependency graph clean.
 */
export class AlarmEngine {
  private rules: CompiledRule[] = []
  private actionExec: (action: AlarmRule['actions'][number]) => Promise<void>

  constructor(
    cfg: AppConfig,
    private repo: AlarmRepo,
    private registry: DeviceRegistry,
    actionExec?: (action: AlarmRule['actions'][number]) => Promise<void>
  ) {
    this.actionExec = actionExec ?? (async () => undefined)
    for (const r of cfg.alarms) {
      if (!r.enabled) continue
      try {
        const pred = compileCondition(r.condition)
        const parsed = parseSource(r.source)
        this.rules.push({ rule: r, pred, ...parsed })
      } catch (e) {
        console.warn(`[AlarmEngine] rule ${r.id} compile failed:`, (e as Error).message)
      }
    }
  }

  start(): void {
    eventBus.onEvent('sample', (e) => this.onSample(e.deviceId, e.samples))
    eventBus.onEvent('pi.cpu_temp', (e) => this.onPi('pi.sensor.cpu_temp_c', e.valueC))
    eventBus.onEvent('pi.error', (e) => this.onPi(`pi.error.${e.source}`, e.message))
    eventBus.onEvent('pi.serial_closed', (e) => this.onPi(`pi.event.serial_closed`, e.path))
    eventBus.onEvent('device.state', (e) => this.onPi(`pi.event.device.${e.deviceId}.${e.state}`, e.detail ?? ''))
  }

  stop(): void {
    eventBus.removeAllListeners()
  }

  private onSample(deviceId: string, samples: { pointId: string; value: unknown; ts: number }[]): void {
    for (const s of samples) {
      for (const cr of this.rules) {
        if (cr.deviceId !== deviceId) continue
        if (cr.pointId !== s.pointId) continue
        this.evaluate(cr, s.value)
      }
    }
  }
  private onPi(source: string, value: unknown): void {
    for (const cr of this.rules) {
      if (cr.deviceId !== undefined) continue
      if (cr.rule.source !== source) continue
      this.evaluate(cr, value)
    }
  }

  private evaluate(cr: CompiledRule, value: unknown): void {
    const triggered = cr.pred(value)
    if (triggered && !cr.activeId) {
      const id = randomUUID()
      const evt: AlarmEvent = {
        id,
        ruleId: cr.rule.id,
        deviceId: cr.deviceId,
        pointId: cr.pointId,
        value: value as AlarmEvent['value'],
        severity: cr.rule.severity,
        message: `${cr.rule.id}: ${JSON.stringify(value)}`,
        triggeredAt: Date.now(),
      }
      cr.activeId = id
      this.repo.recordEvent(evt)
      eventBus.emitEvent({ type: 'alarm', event: evt })
      void this.runActions(cr.rule.actions, evt)
    } else if (!triggered && cr.activeId) {
      this.repo.resolve(cr.activeId, Date.now())
      cr.activeId = undefined
    }
  }

  private async runActions(actions: AlarmRule['actions'], evt: AlarmEvent): Promise<void> {
    for (const a of actions) {
      try {
        if (a.type === 'device.write') {
          // Re-dispatch as a control event; ControlRouter (or registry) handles
          const [deviceId, , pointId] = a.target.split('.')
          if (deviceId && pointId) {
            const drv = this.registry.get(deviceId)
            if (drv) await drv.writePoint(pointId, a.value)
          }
        } else if (a.type === 'notify.sse') {
          // SSE subscribers will see the 'alarm' event already
        }
        await this.actionExec(a)
      } catch (e) {
        console.warn(`[AlarmEngine] action ${a.type} failed:`, (e as Error).message)
      }
    }
  }
}

function parseSource(src: string): { deviceId?: string; pointId?: string } {
  // '<deviceId>.point.<pointId>' → { deviceId, pointId }
  const m = /^([^.]+)\.point\.([^.]+)$/.exec(src)
  if (m) return { deviceId: m[1], pointId: m[2] }
  return {}
}