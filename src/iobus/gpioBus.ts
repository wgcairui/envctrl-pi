import type { IOBus } from './types.js'

export type GpioEdge = 'none' | 'rising' | 'falling' | 'both'

/**
 * GPIO bus abstraction. Backed by `onoff` on Linux. On non-Linux platforms
 * (e.g. macOS dev machine) `onoff` is dynamically imported; if it fails
 * to load, the bus operates in stub mode — write() succeeds silently,
 * read() returns false, watch() is a no-op. This keeps cross-platform
 * development frictionless while preserving real hardware access on Pi.
 */
export class GpioBus implements IOBus {
  readonly id = 'gpio'
  readonly kind = 'gpio' as const
  private onoff: typeof import('onoff') | null = null
  private inputs = new Map<number, import('onoff').Gpio>()

  async init(): Promise<void> {
    if (process.platform === 'linux') {
      try {
        this.onoff = await import('onoff')
      } catch (e) {
        console.warn('[GpioBus] onoff load failed, running in stub mode:', (e as Error).message)
        this.onoff = null
      }
    } else {
      console.warn(`[GpioBus] onoff only works on Linux (current: ${process.platform}); stub mode`)
      this.onoff = null
    }
  }

  write(pin: number, value: boolean): void {
    if (!this.onoff) return
    const g = new this.onoff.Gpio(pin, 'out')
    g.writeSync(value ? 1 : 0)
    g.unexport()
  }

  read(pin: number): boolean {
    if (!this.onoff) return false
    const g = new this.onoff.Gpio(pin, 'in')
    const v = g.readSync()
    g.unexport()
    return v === 1
  }

  /**
   * Watch for edge events. Returns a stop function.
   * `debounceMs` filters events closer than this.
   */
  watch(pin: number, edge: GpioEdge, handler: (value: boolean) => void, debounceMs = 50): () => void {
    if (!this.onoff) {
      return () => undefined
    }
    const g = new this.onoff.Gpio(pin, 'in', edge)
    let lastTs = 0
    g.watch((err, value) => {
      if (err) return
      const now = Date.now()
      if (debounceMs > 0 && now - lastTs < debounceMs) return
      lastTs = now
      handler(value === 1)
    })
    this.inputs.set(pin, g)
    return () => {
      try {
        g.unwatchAll()
        g.unexport()
      } catch {
        /* ignore */
      }
      this.inputs.delete(pin)
    }
  }

  async close(): Promise<void> {
    for (const [, g] of this.inputs) {
      try {
        g.unwatchAll()
        g.unexport()
      } catch {
        /* ignore */
      }
    }
    this.inputs.clear()
  }
}