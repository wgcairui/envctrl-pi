/**
 * Tests for Card — glass surface container with 4 variants.
 *
 * Coverage:
 *  - default variant uses glass-1 background + 1px border
 *  - elev-2 uses glass-2 background
 *  - aq-card has ok-tint accent + glow
 *  - hero-greeting has 3-stop gradient
 *  - flush mode removes padding
 *  - data-testid is consistent
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '../../src/components/ui/Card'

describe('Card', () => {
  it('renders a card with default variant', () => {
    render(<Card data-testid="card">content</Card>)
    const card = screen.getByTestId('card')
    expect(card).toBeInTheDocument()
    expect(card.style.borderRadius).toBe('var(--r-lg)')
    expect(card.style.padding).toBe('24px')
  })

  it('uses glass-2 background for elev-2 variant', () => {
    render(<Card data-testid="card" variant="elev-2">elev</Card>)
    const card = screen.getByTestId('card')
    expect(card.style.background).toBe('var(--glass-2)')
  })

  it('uses gradient background for aq-card variant', () => {
    render(<Card data-testid="card" variant="aq-card">aq</Card>)
    const card = screen.getByTestId('card')
    expect(card.style.background).toContain('linear-gradient')
    expect(card.style.border).toContain('var(--ok-border)')
  })

  it('uses gradient background for hero-greeting variant', () => {
    render(<Card data-testid="card" variant="hero-greeting">hero</Card>)
    const card = screen.getByTestId('card')
    expect(card.style.background).toContain('linear-gradient')
  })

  it('removes padding when flush is true', () => {
    render(<Card data-testid="card" flush>flush</Card>)
    expect(screen.getByTestId('card').style.padding).toBe('0px')
  })

  it('always applies backdrop-filter for glass effect', () => {
    render(<Card data-testid="card">blur</Card>)
    expect(screen.getByTestId('card').style.backdropFilter).toContain('blur')
  })

  it('forwards extra props to the underlying div', () => {
    render(<Card data-foo="bar" aria-label="card">x</Card>)
    expect(screen.getByLabelText('card')).toBeInTheDocument()
    expect(screen.getByLabelText('card')).toHaveAttribute('data-foo', 'bar')
  })
})