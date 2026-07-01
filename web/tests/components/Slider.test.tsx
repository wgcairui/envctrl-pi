/**
 * Tests for Slider — range input with formatted readout.
 *
 * Coverage:
 *  - renders input[type=range] with min/max/value
 *  - readout formats value + unit with right decimals
 *  - onChange fires with the new value
 *  - disabled blocks interaction
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Slider } from '../../src/components/ui/Slider'

describe('Slider', () => {
  it('renders range input with current value', () => {
    render(<Slider value={42} min={0} max={100} aria-label="brightness" />)
    const input = screen.getByLabelText('brightness') as HTMLInputElement
    expect(input.type).toBe('range')
    expect(input.value).toBe('42')
  })

  it('respects min/max/step', () => {
    render(<Slider value={50} min={10} max={90} step={5} aria-label="x" />)
    const input = screen.getByLabelText('x') as HTMLInputElement
    expect(input.min).toBe('10')
    expect(input.max).toBe('90')
    expect(input.step).toBe('5')
  })

  it('formats the readout with the right decimals and unit', () => {
    render(<Slider value={23.456} min={0} max={100} decimals={1} unit="°C" aria-label="t" />)
    expect(screen.getByText('°C')).toBeInTheDocument()
    expect(screen.getByText('23.5')).toBeInTheDocument()
  })

  it('fires onChange when user moves the slider', () => {
    const onChange = vi.fn()
    render(<Slider value={0} min={0} max={100} onChange={onChange} aria-label="s" />)
    const input = screen.getByLabelText('s') as HTMLInputElement
    // range inputs can't be cleared; use fireEvent.change directly
    fireEvent.change(input, { target: { value: '75' } })
    expect(onChange).toHaveBeenCalledWith(75)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Slider value={50} min={0} max={100} disabled aria-label="d" />)
    const input = screen.getByLabelText('d') as HTMLInputElement
    expect(input).toBeDisabled()
  })

  it('uses tabular-nums for stable width', () => {
    render(<Slider value={1} min={0} max={100} aria-label="t" />)
    const readout = screen.getByText('1')
    expect(readout.style.fontVariantNumeric).toBe('tabular-nums')
  })
})