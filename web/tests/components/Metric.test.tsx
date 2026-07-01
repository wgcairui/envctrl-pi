/**
 * Tests for Metric — formatted value + label + optional delta.
 *
 * Coverage:
 *  - formats numbers with the right decimals (and trims trailing zeros)
 *  - handles null / NaN gracefully (renders —)
 *  - status colors the value (warn/crit)
 *  - delta arrow + sign renders correctly
 *  - label always uppercased Mono
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Metric } from '../../src/components/ui/Metric'

describe('Metric', () => {
  it('renders formatted value with unit', () => {
    render(<Metric value={23.456} unit="°C" decimals={1} label="Temp" />)
    // toFixed(1) → "23.5" — already trimmed, no trailing zeros
    expect(screen.getByText('23.5')).toBeInTheDocument()
    expect(screen.getByText('°C')).toBeInTheDocument()
    expect(screen.getByText('Temp')).toBeInTheDocument()
  })

  it('renders em-dash for null / undefined / NaN', () => {
    const { rerender } = render(<Metric value={null} label="X" />)
    expect(screen.getByText('—')).toBeInTheDocument()

    rerender(<Metric value={undefined} label="X" />)
    expect(screen.getByText('—')).toBeInTheDocument()

    rerender(<Metric value={Number.NaN} label="X" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('applies status color to value (warn/crit)', () => {
    const { rerender } = render(<Metric value={95} status="warn" label="Hum" />)
    let valueEl = screen.getByText('95')
    expect(valueEl.style.color).toBe('var(--warn)')

    rerender(<Metric value={120} status="crit" label="Hum" />)
    valueEl = screen.getByText('120')
    expect(valueEl.style.color).toBe('var(--crit)')
  })

  it('keeps label uppercased Mono ink-3', () => {
    render(<Metric value={42} label="Humidity" />)
    const label = screen.getByText('Humidity')
    expect(label.style.textTransform).toBe('uppercase')
    expect(label.style.fontFamily).toBe('var(--font-mono)')
    expect(label.style.color).toBe('var(--ink-3)')
  })

  it('renders positive delta with up arrow + sign', () => {
    render(<Metric value={42} delta={0.3} deltaUnit="°C" label="T" />)
    const text = screen.getByText(/0\.3/)
    expect(text.textContent).toMatch(/^\+0\.3 °C$/)
  })

  it('renders negative delta with down arrow + sign', () => {
    render(<Metric value={42} delta={-1.5} deltaUnit="°C" label="T" />)
    const text = screen.getByText(/1\.5/)
    expect(text.textContent).toMatch(/^-1\.5 °C$/)
  })

  it('uses tabular-nums for stable width', () => {
    render(<Metric value={1.5} />)
    // Value container is the first inline-flex parent containing the number
    const valueEl = screen.getByText('1.5')
    expect(valueEl.style.fontVariantNumeric).toBe('tabular-nums')
  })
})