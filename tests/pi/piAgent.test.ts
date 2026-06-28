import { describe, it, expect } from 'vitest'
import {
  parseConfigTxt,
  applyConfigChange,
  conflictsWith,
  occupiedGpio,
  UART_GPIO_MAP,
  ALLOWED_OVERLAYS,
} from '../../src/pi/configOps.js'
import { renderUdevRule, renderUdevRulesFile } from '../../src/pi/udevOps.js'

describe('parseConfigTxt', () => {
  it('parses dtoverlay lines and resolves uart gpio mapping', () => {
    const text = `
# Comments ignored
enable_uart=1
dtoverlay=uart2
dtoverlay=uart5
dtoverlay=spi
`
    const parsed = parseConfigTxt(text)
    expect(parsed.find((p) => p.name === 'uart2')?.deviceNode).toBe('/dev/ttyAMA1')
    expect(parsed.find((p) => p.name === 'uart5')?.deviceNode).toBe('/dev/ttyAMA4')
    expect(parsed.find((p) => p.name === 'spi')?.occupiedGpio).toBeUndefined()
  })

  it('marks occupied GPIOs for uart overlays', () => {
    const parsed = parseConfigTxt('dtoverlay=uart3\n')
    expect(parsed[0]?.occupiedGpio).toEqual([4, 5])
  })
})

describe('occupiedGpio + conflictsWith', () => {
  it('aggregates GPIO from all enabled uart overlays', () => {
    const parsed = parseConfigTxt('dtoverlay=uart2\ndtoverlay=uart3\n')
    expect(occupiedGpio(parsed)).toEqual([0, 1, 4, 5])
  })

  it('detects GPIO conflicts when adding a new uart', () => {
    const parsed = parseConfigTxt('dtoverlay=uart2\n')
    expect(conflictsWith('uart3', parsed)).toEqual([])
    expect(conflictsWith('uart2', parsed)).toEqual([0, 1])
  })
})

describe('applyConfigChange', () => {
  it('adds new overlays to the end', () => {
    const text = '# head\nenable_uart=1\n'
    const out = applyConfigChange(text, { toAdd: ['dtoverlay=uart2'], toRemove: [] })
    expect(out).toContain('enable_uart=1')
    expect(out).toContain('dtoverlay=uart2')
  })

  it('removes existing overlays', () => {
    const text = 'enable_uart=1\ndtoverlay=uart2\n'
    const out = applyConfigChange(text, { toAdd: [], toRemove: ['uart2'] })
    expect(out).not.toContain('dtoverlay=uart2')
  })

  it('rejects unknown overlay', () => {
    expect(() => applyConfigChange('', { toAdd: ['dtoverlay=evil'], toRemove: [] })).toThrow(/not allowed/)
  })

  it('ALLOWED_OVERLAYS includes common uart/spi/i2c', () => {
    expect(ALLOWED_OVERLAYS.has('dtoverlay=uart2')).toBe(true)
    expect(ALLOWED_OVERLAYS.has('dtparam=spi')).toBe(true)
  })
})

describe('UART_GPIO_MAP covers all documented UARTs', () => {
  it('uart2/3/4/5 mapped to ttyAMA1-4', () => {
    expect(UART_GPIO_MAP.uart2?.device).toBe('/dev/ttyAMA1')
    expect(UART_GPIO_MAP.uart3?.device).toBe('/dev/ttyAMA2')
    expect(UART_GPIO_MAP.uart4?.device).toBe('/dev/ttyAMA3')
    expect(UART_GPIO_MAP.uart5?.device).toBe('/dev/ttyAMA4')
  })
})

describe('udevOps', () => {
  it('renders single rule', () => {
    const r = renderUdevRule({ matchVendor: '1a86', matchProduct: '7523', symlink: 'ttyRS485_a' })
    expect(r).toContain('ATTRS{idVendor}=="1a86"')
    expect(r).toContain('SYMLINK+="ttyRS485_a"')
    expect(r).toContain('GROUP="dialout"')
  })

  it('renders multi-rule file', () => {
    const f = renderUdevRulesFile([
      { matchVendor: '1a86', symlink: 'ttyRS485_a' },
      { matchSerial: 'ABC123', symlink: 'ttyRS485_b' },
    ])
    expect(f).toContain('ttyRS485_a')
    expect(f).toContain('ttyRS485_b')
    expect(f).toContain('ATTRS{serial}=="ABC123"')
  })
})