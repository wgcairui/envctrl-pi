import { Socket } from 'node:net'
import { EventEmitter } from 'node:events'
import type { IOBus } from './types.js'

/**
 * Parses bus ids of the form "tcp:host:port" or "tcp:host:port:unitId".
 * Used for Modbus TCP clients.
 */
export function parseTcpBusId(s: string): { host: string; port: number; unitId?: number } {
  const m = /^tcp:([^:]+):(\d+)(?::(\d+))?$/.exec(s)
  if (!m) throw new Error(`Invalid tcp bus id: ${s}`)
  const [, host, portStr, unitStr] = m
  return { host: host!, port: parseInt(portStr!, 10), unitId: unitStr ? parseInt(unitStr, 10) : undefined }
}

/**
 * Plain TCP socket bus. For Modbus TCP, modbus-serial opens its own socket;
 * this class is the lower-level transport for any TCP-based driver.
 */
export class TcpBus extends EventEmitter implements IOBus {
  readonly id: string
  readonly kind = 'tcp' as const
  private socket: Socket | null = null
  private buffer: Buffer = Buffer.alloc(0)
  private closed = false

  constructor(id: string, private addr: { host: string; port: number }) {
    super()
    this.id = id
  }

  async init(): Promise<void> {
    this.closed = false
    await this.connect()
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = new Socket()
      const onError = (err: Error) => {
        sock.destroy()
        reject(err)
      }
      sock.once('error', onError)
      sock.connect(this.addr.port, this.addr.host, () => {
        sock.removeListener('error', onError)
        this.socket = sock
        sock.on('data', (chunk) => this.handleData(chunk))
        sock.on('close', () => {
          this.socket = null
          this.emit('close')
          if (!this.closed) this.connect().catch((e) => this.emit('error', e))
        })
        sock.on('error', (e) => this.emit('error', e))
        this.emit('open')
        resolve()
      })
    })
  }

  private handleData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk])
    this.emit('data', chunk)
  }

  /** Consume buffered bytes (used by framing drivers like Modbus TCP) */
  takeBuffered(): Buffer {
    const out = this.buffer
    this.buffer = Buffer.alloc(0)
    return out
  }

  async write(data: Buffer): Promise<void> {
    if (!this.socket) throw new Error(`TcpBus ${this.id} not connected`)
    return new Promise((resolve, reject) => {
      this.socket!.write(data, (err) => (err ? reject(err) : resolve()))
    })
  }

  async close(): Promise<void> {
    this.closed = true
    if (this.socket) {
      await new Promise<void>((res) => this.socket!.end(() => res()))
    }
    this.socket = null
  }
}