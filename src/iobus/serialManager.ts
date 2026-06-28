import { SerialPort } from 'serialport'
import { EventEmitter } from 'node:events'
import type { IOBus } from './types.js'

export interface SerialBusConfig {
  id: string
  path: string
  baudRate: number
}

/**
 * Manages a single SerialPort identified by id. Multiple drivers may share
 * the same path by opening the underlying device separately — Linux's
 * exclusive flock (lock:true default) prevents collisions.
 *
 * Reconnect with exponential backoff on close/error.
 */
export class SerialBus extends EventEmitter implements IOBus {
  readonly id: string
  readonly kind = 'serial' as const
  private port: SerialPort | null = null
  private closed = false
  private reconnectAttempt = 0
  private reconnectTimer: NodeJS.Timeout | null = null

  constructor(private cfg: SerialBusConfig) {
    super()
    this.id = cfg.id
  }

  async init(): Promise<void> {
    this.closed = false
    await this.open()
  }

  private async open(): Promise<void> {
    if (this.closed) return
    return new Promise<void>((resolve, reject) => {
      const port = new SerialPort(
        { path: this.cfg.path, baudRate: this.cfg.baudRate, lock: true, autoOpen: false },
        (err) => {
          if (err) {
            this.emit('error', err)
            reject(err)
            return
          }
          this.port = port
          this.reconnectAttempt = 0
          this.emit('open')
          resolve()
        }
      )
      port.on('close', () => {
        this.port = null
        this.emit('close')
        if (!this.closed) this.scheduleReconnect()
      })
      port.on('error', (err) => {
        this.emit('error', err)
      })
    })
  }

  private scheduleReconnect(): void {
    if (this.closed) return
    const delay = Math.min(30_000, 500 * 2 ** this.reconnectAttempt)
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => {
      this.open().catch(() => undefined)
    }, delay)
  }

  write(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.port) return reject(new Error(`Serial ${this.id} not open`))
      this.port.write(data, (err) => (err ? reject(err) : resolve()))
    })
  }

  /** Attach a parser / data handler. Returns the port for piping. */
  port_(): SerialPort {
    if (!this.port) throw new Error(`Serial ${this.id} not open`)
    return this.port
  }

  async close(): Promise<void> {
    this.closed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.port) {
      await new Promise<void>((res) => this.port!.close(() => res()))
    }
    this.port = null
  }
}