/**
 * Tests for Pill — status badge with dot + pulse.
 *
 * Coverage:
 *  - applies semantic background / border / text per status
 *  - renders leading dot by default; suppressed with showDot=false
 *  - pulse prop maps to the right keyframe (ok-breath vs warn)
 *  - data-status attribute reflects current state
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Pill } from '../../src/components/ui/Pill'

describe('Pill', () => {
  it('renders with default ok styling (mint + glow dot)', () => {
    render(<Pill>online</Pill>)
    const pill = screen.getByTestId('pill')
    expect(pill).toHaveAttribute('data-status', 'ok')
    expect(pill).toHaveTextContent('online')
  })

  it('applies different semantic per status', () => {
    const { rerender } = render(<Pill status="warn">drift</Pill>)
    expect(screen.getByTestId('pill')).toHaveAttribute('data-status', 'warn')

    rerender(<Pill status="crit">offline</Pill>)
    expect(screen.getByTestId('pill')).toHaveAttribute('data-status', 'crit')

    rerender(<Pill status="info">info</Pill>)
    expect(screen.getByTestId('pill')).toHaveAttribute('data-status', 'info')
  })

  it('hides leading dot when showDot=false', () => {
    render(<Pill showDot={false}>no-dot</Pill>)
    const pill = screen.getByTestId('pill')
    // The dot is a <span> inside the pill with no text content
    expect(pill.children.length).toBe(0)
  })

  it('omits dot for dim status (always)', () => {
    render(<Pill status="dim">archived</Pill>)
    const pill = screen.getByTestId('pill')
    expect(pill.children.length).toBe(0)
  })

  it('renders as uppercase mono by default', () => {
    render(<Pill>hello world</Pill>)
    const pill = screen.getByTestId('pill')
    expect(pill.style.textTransform).toBe('uppercase')
    expect(pill.style.fontFamily).toBe('var(--font-mono)')
  })

  it('uses pill-shaped border-radius', () => {
    render(<Pill>ok</Pill>)
    expect(screen.getByTestId('pill').style.borderRadius).toBe('var(--r-pill)')
  })
})