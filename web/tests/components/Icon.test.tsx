/**
 * Tests for Icon — the unified SVG icon system.
 *
 * Coverage:
 *  - renders the right SVG node with the right testid
 *  - size prop affects width/height
 *  - aria-label adds role="img" and exposes label; otherwise aria-hidden
 *  - currentColor stroke (color follows parent text)
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Icon } from '../../src/components/ui/Icon'

describe('Icon', () => {
  it('renders the requested icon by name', () => {
    render(<Icon name="check" aria-label="confirm" />)
    const el = screen.getByTestId('icon-check')
    expect(el).toBeInTheDocument()
    expect(el.tagName).toBe('svg')
  })

  it('applies width and height from size prop', () => {
    render(<Icon name="cpu" size={24} />)
    const el = screen.getByTestId('icon-cpu')
    expect(el.style.width).toBe('24px')
    expect(el.style.height).toBe('24px')
  })

  it('defaults size to 16 when omitted', () => {
    render(<Icon name="cog" />)
    const el = screen.getByTestId('icon-cog')
    expect(el.style.width).toBe('16px')
    expect(el.style.height).toBe('16px')
  })

  it('uses role="img" and exposes aria-label when provided', () => {
    render(<Icon name="wifi" aria-label="connected" />)
    const el = screen.getByRole('img', { name: 'connected' })
    expect(el).toBeInTheDocument()
  })

  it('is aria-hidden by default (decorative)', () => {
    render(<Icon name="cog" />)
    const el = screen.getByTestId('icon-cog')
    expect(el).toHaveAttribute('aria-hidden', 'true')
    expect(el).not.toHaveAttribute('role')
  })

  it('renders as inline-flex sized box', () => {
    render(<Icon name="check" />)
    const el = screen.getByTestId('icon-check')
    expect(el).toHaveAttribute('stroke', 'currentColor')
    expect(el).toHaveAttribute('stroke-width', '2')
  })
})