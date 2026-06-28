import type { AppConfig } from '../config/loader.js'
import type { DeviceRegistry } from './deviceRegistry.js'
import { SampleRepo } from '../storage/repositories.js'
import { eventBus } from './eventBus.js'

/**
 * DataEngine — periodically polls each driver's `readPoints()` and:
 *   1. Persists samples to SQLite (transactional batch)
 *   2. Emits `sample` events onto the event bus
 */
export class DataEngine {
  private timers = new Map<string, NodeJS.Timeout>()

  constructor(
    private cfg: AppConfig,
    private registry: DeviceRegistry,
    private samples: SampleRepo
  ) {}

  start(): void {
    for (const d of this.registry.list()) {
      const dc = this.cfg.devices.find((x) => x.id === d.id)
      const period = dc?.pollMs ?? 5000
      const run = async () => {
        try {
          const samples = await d.readPoints()
          if (samples.length > 0) {
            this.samples.insertBatch(d.id, samples)
            eventBus.emitEvent({ type: 'sample', deviceId: d.id, samples })
          }
        } catch (e) {
          eventBus.emitEvent({
            type: 'device.state',
            deviceId: d.id,
            state: 'error',
            detail: (e as Error).message,
          })
        }
      }
      // immediate first read
      void run()
      this.timers.set(d.id, setInterval(run, period))
    }
  }

  stop(): void {
    for (const t of this.timers.values()) clearInterval(t)
    this.timers.clear()
  }
}