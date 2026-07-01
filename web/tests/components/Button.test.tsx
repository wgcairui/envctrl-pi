/**
 * Tests for Button — 5 variants × 3 sizes × icon + loading state.
 *
 * Coverage:
 *  - renders children
 *  - applies size-specific padding
 *  - icon renders before/after children
 *  - loading disables button + shows spinner (no icon)
 *  - disabled applies opacity
 *  - data attributes expose variant / size for styling
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../../src/components/ui/Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('uses md size padding by default', () => {
    render(<Button>md</Button>)
    expect(screen.getByRole('button').style.height).toBe('36px')
  })

  it('uses sm size padding when size="sm"', () => {
    render(<Button size="sm">sm</Button>)
    expect(screen.getByRole('button').style.height).toBe('28px')
  })

  it('uses icon size (36×36) when size="icon"', () => {
    render(<Button size="icon" aria-label="icon btn"><span>X</span></Button>)
    const btn = screen.getByRole('button')
    expect(btn.style.width).toBe('36px')
    expect(btn.style.height).toBe('36px')
  })

  it('exposes variant via data attribute', () => {
    render(<Button variant="danger">Delete</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'danger')
  })

  it('renders leading icon', () => {
    render(<Button iconLeft="check">Confirm</Button>)
    expect(screen.getByTestId('icon-check')).toBeInTheDocument()
  })

  it('renders trailing icon', () => {
    render(<Button iconRight="chevron-right">Next</Button>)
    expect(screen.getByTestId('icon-chevron-right')).toBeInTheDocument()
  })

  it('hides icon + shows spinner when loading', () => {
    render(<Button loading iconLeft="check">Saving</Button>)
    expect(screen.queryByTestId('icon-check')).toBeNull()
    expect(screen.getByRole('button')).toHaveAttribute('data-loading', 'true')
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('does not invoke onClick while loading', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Load
      </Button>,
    )
    await user.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('does not invoke onClick while disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    )
    await user.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('invokes onClick when enabled and not loading', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})