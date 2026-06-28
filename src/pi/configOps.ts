import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { basename } from 'node:path'

const ALLOWED_OVERLAYS = new Set([
  'enable_uart',
  'disable_uart',
  'dtoverlay=disable-bt',
  'dtoverlay=enable-bt',
  'dtoverlay=miniuart-bt',
  'dtoverlay=uart0',
  'dtoverlay=uart2',
  'dtoverlay=uart3',
  'dtoverlay=uart4',
  'dtoverlay=uart5',
  'dtparam=i2c_arm',
  'dtparam=i2c',
  'dtparam=spi',
  'dtparam=audio',
  'dtoverlay=i2c1',
  'dtoverlay=i2c-rtc',
  'dtoverlay=w1-gpio',
])

const UART_GPIO_MAP: Record<string, { txd: number; rxd: number; device: string }> = {
  uart0: { txd: 14, rxd: 15, device: '/dev/ttyAMA0' },
  uart2: { txd: 0, rxd: 1, device: '/dev/ttyAMA1' },
  uart3: { txd: 4, rxd: 5, device: '/dev/ttyAMA2' },
  uart4: { txd: 8, rxd: 9, device: '/dev/ttyAMA3' },
  uart5: { txd: 12, rxd: 13, device: '/dev/ttyAMA4' },
}

export interface ParsedOverlay {
  raw: string       // e.g. "dtoverlay=uart2"
  name: string      // e.g. "uart2"
  occupiedGpio?: number[]
  deviceNode?: string
}

export function parseConfigTxt(text: string): ParsedOverlay[] {
  const out: ParsedOverlay[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (trimmed.startsWith('dtoverlay=') || trimmed.startsWith('enable_uart') || trimmed.startsWith('disable_uart')) {
      const name = trimmed.replace(/^dtoverlay=|=.*$/, '').trim()
      const uartInfo = UART_GPIO_MAP[name]
      out.push({
        raw: trimmed,
        name,
        occupiedGpio: uartInfo ? [uartInfo.txd, uartInfo.rxd] : undefined,
        deviceNode: uartInfo?.device,
      })
    }
  }
  return out
}

export function filterOverlays(parsed: ParsedOverlay[], names: string[]): ParsedOverlay[] {
  return parsed.filter((p) => names.includes(p.name))
}

export function occupiedGpio(parsed: ParsedOverlay[]): number[] {
  const out = new Set<number>()
  for (const p of parsed) for (const g of p.occupiedGpio ?? []) out.add(g)
  return [...out].sort((a, b) => a - b)
}

/** Check that `overlayName` doesn't occupy a GPIO already in use by config */
export function conflictsWith(overlayName: string, existing: ParsedOverlay[]): number[] {
  const pin = UART_GPIO_MAP[overlayName]
  if (!pin) return []
  const occupied = occupiedGpio(existing)
  return [pin.txd, pin.rxd].filter((g) => occupied.includes(g))
}

export interface ConfigChange {
  toAdd: string[]
  toRemove: string[]
}

export function applyConfigChange(text: string, change: ConfigChange): string {
  const lines = text.split(/\r?\n/)
  const out: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    let skip = false
    for (const rm of change.toRemove) {
      if (trimmed.startsWith('dtoverlay=' + rm) || trimmed === rm || trimmed === `enable_${rm}` || trimmed === `disable_${rm}`) {
        skip = true
        break
      }
    }
    if (!skip) out.push(line)
  }
  for (const add of change.toAdd) {
    if (!ALLOWED_OVERLAYS.has(add)) throw new Error(`Overlay not allowed: ${add}`)
    out.push(add)
  }
  return out.join('\n')
}

export function backupPath(path: string): string {
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')
  return `${path}.bak-${ts}`
}

export function readConfig(path: string): string {
  if (!existsSync(path)) return ''
  return readFileSync(path, 'utf8')
}

export function writeConfigWithBackup(path: string, newContent: string): { backup: string } {
  const bp = backupPath(path)
  if (existsSync(path)) copyFileSync(path, bp)
  writeFileSync(path, newContent, 'utf8')
  return { backup: bp }
}

export { ALLOWED_OVERLAYS, UART_GPIO_MAP }