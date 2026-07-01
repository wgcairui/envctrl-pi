/**
 * Tests for Chip — filter / toggle pill with optional count badge.
 *
 * Coverage:
 *  - active vs inactive styling (data-active attribute)
 *  - aria-pressed for clickable chip
 *  - count badge renders when provided
 *  - renders as button when onClick supplied, span otherwise
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Chip } from '../../src/components/ui/Chip'

describe('Chip', () => {
  it('renders with default (inactive) state', () => {
    render(<Chip>all</Chip>)
    const chip = screen.getByTestId('chip')
    expect(chip).toBeInTheDocument()
    expect(chip).not.toHaveAttribute('data-active')
  })

  it('renders with active styling when active=true', () => {
    render(<Chip active>active-chip</Chip>)
    expect(screen.getByTestId('chip')).toHaveAttribute('data-active', 'true')
  })

  it('renders as button when onClick supplied', () => {
    render(<Chip onClick={() => {}}>btn</Chip>)
    expect(screen.getByRole('button', { name: 'btn' })).toBeInTheDocument()
  })

  it('renders as span when onClick omitted', () => {
    render(<Chip>static</Chip>)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByTestId('chip').tagName).toBe('SPAN')
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Chip onClick={onClick}>clickable</Chip>)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('exposes aria-pressed for clickable chip', () => {
    render(<Chip active onClick={() => {}}>active</Chip>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders count badge when count provided', () => {
    render(<Chip count={42}>devices</Chip>)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('omits count when not a number', () => {
    const { container } = render(<Chip>no-count</Chip>)
    // Only the label span should be inside
    expect(container.querySelectorAll('span').length).toBe(1)
  })
})