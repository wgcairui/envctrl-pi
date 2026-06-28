import { describe, it, expect, beforeEach } from 'vitest'
import { BusRegistry, type IOBus } from '../../src/iobus/types.js'
import { GpioBus } from '../../src/iobus/gpioBus.js'
import { parseTcpBusId, TcpBus } from '../../src/iobus/tcpBus.js'

describe('BusRegistry', () => {
  let reg: BusRegistry
  beforeEach(() => {
    reg = new BusRegistry()
  })

  it('registers and retrieves', () => {
    const bus: IOBus = {
      id: 'x',
      kind: 'serial',
      init: async () => undefined,
      close: async () => undefined,
    }
    reg.register(bus)
    expect(reg.get('x').id).toBe('x')
    expect(reg.has('x')).toBe(true)
  })

  it('throws on duplicate', () => {
    const bus: IOBus = {
      id: 'x',
      kind: 'gpio',
      init: async () => undefined,
      close: async () => undefined,
    }
    reg.register(bus)
    expect(() => reg.register(bus)).toThrow(/already/)
  })

  it('throws on unknown id', () => {
    expect(() => reg.get('zzz')).toThrow(/not registered/)
  })
})

describe('GpioBus', () => {
  it('initialises in stub mode on non-linux', async () => {
    const b = new GpioBus()
    await b.init()
    // read/write are no-ops without throwing
    b.write(17, true)
    expect(b.read(27)).toBe(false)
    const stop = b.watch(27, 'both', () => undefined)
    expect(typeof stop).toBe('function')
    stop()
    await b.close()
  })
})

describe('TcpBus id parser', () => {
  it('parses tcp:host:port', () => {
    expect(parseTcpBusId('tcp:10.0.0.1:502')).toEqual({ host: '10.0.0.1', port: 502 })
  })
  it('parses with unit id', () => {
    expect(parseTcpBusId('tcp:10.0.0.1:502:1')).toEqual({ host: '10.0.0.1', port: 502, unitId: 1 })
  })
  it('rejects invalid', () => {
    expect(() => parseTcpBusId('serial:/dev/ttyUSB0')).toThrow()
  })
})

describe('TcpBus e2e', () => {
  it('connects, writes, receives echo', async () => {
    const { createServer } = await import('node:net')
    const server = createServer((sock) => sock.pipe(sock))
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', res))
    const addr = server.address() as { port: number }

    const bus = new TcpBus('tcp:test', { host: '127.0.0.1', port: addr.port })
    await bus.init()

    const got = new Promise<Buffer>((res) => bus.once('data', res))
    await bus.write(Buffer.from('hello'))
    const data = await Promise.race([
      got,
      new Promise<Buffer>((_, rej) => setTimeout(() => rej(new Error('timeout')), 1000)),
    ])
    expect(data.toString()).toBe('hello')
    await bus.close()
    await new Promise<void>((res) => server.close(() => res()))
  }, 5000)
})