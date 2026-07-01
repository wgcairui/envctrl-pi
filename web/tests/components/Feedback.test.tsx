/**
 * Tests for Skeleton, EmptyState, ErrorState, Pulse, Tooltip.
 *
 * Quick coverage: rendering + key attributes.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { ErrorState } from '../../src/components/ui/ErrorState'
import { Pulse } from '../../src/components/ui/Pulse'
import { Tooltip } from '../../src/components/ui/Tooltip'
import { Button } from '../../src/components/ui/Button'

describe('Skeleton', () => {
  it('renders block variant with default dimensions', () => {
    render(<Skeleton />)
    const sk = screen.getByTestId('skeleton')
    expect(sk).toHaveAttribute('data-variant', 'block')
  })

  it('renders text variant as shorter pill', () => {
    render(<Skeleton variant="text" />)
    expect(screen.getByTestId('skeleton')).toHaveAttribute('data-variant', 'text')
  })

  it('renders circle variant with 50% radius', () => {
    render(<Skeleton variant="circle" />)
    const sk = screen.getByTestId('skeleton')
    expect(sk.style.borderRadius).toBe('50%')
  })

  it('accepts custom width / height', () => {
    render(<Skeleton width={120} height={32} />)
    const sk = screen.getByTestId('skeleton')
    expect(sk.style.width).toBe('120px')
    expect(sk.style.height).toBe('32px')
  })

  it('uses shimmer animation', () => {
    render(<Skeleton />)
    expect(screen.getByTestId('skeleton').style.animation).toContain('skeleton-shimmer')
  })
})

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No data" description="add some" icon="database" />)
    expect(screen.getByText('No data')).toBeInTheDocument()
    expect(screen.getByText('add some')).toBeInTheDocument()
  })

  it('renders the requested icon', () => {
    render(<EmptyState title="x" icon="database" />)
    expect(screen.getByTestId('icon-database')).toBeInTheDocument()
  })

  it('renders action when provided', () => {
    render(
      <EmptyState
        title="x"
        action={<Button>Add</Button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })
})

describe('ErrorState', () => {
  it('renders alert role with crit styling', () => {
    render(<ErrorState title="Oops" message="try again" />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(screen.getByText('Oops')).toBeInTheDocument()
    expect(screen.getByText('try again')).toBeInTheDocument()
  })

  it('uses alert-circle icon', () => {
    render(<ErrorState />)
    expect(screen.getByTestId('icon-alert-circle')).toBeInTheDocument()
  })

  it('has default title when none supplied', () => {
    render(<ErrorState />)
    expect(screen.getByText(/Couldn't load/)).toBeInTheDocument()
  })
})

describe('Pulse', () => {
  it('renders with default static mode', () => {
    render(<Pulse aria-label="live" />)
    const p = screen.getByTestId('pulse')
    expect(p).toHaveAttribute('data-mode', 'static')
  })

  it('breath mode applies pulse-breath animation', () => {
    render(<Pulse mode="breath" />)
    const p = screen.getByTestId('pulse')
    expect(p.style.animation).toContain('pulse-breath')
  })

  it('warn mode applies pulse-warn', () => {
    render(<Pulse mode="warn" />)
    const p = screen.getByTestId('pulse')
    expect(p.style.animation).toContain('pulse-warn')
  })

  it('crit mode applies pulse-crit', () => {
    render(<Pulse mode="crit" />)
    const p = screen.getByTestId('pulse')
    expect(p.style.animation).toContain('pulse-crit')
  })

  it('static mode has no animation', () => {
    render(<Pulse mode="static" />)
    const p = screen.getByTestId('pulse')
    expect(p.style.animation).toBe('')
  })

  it('applies size prop', () => {
    render(<Pulse size={10} />)
    expect(screen.getByTestId('pulse').style.width).toBe('10px')
  })
})

describe('Tooltip', () => {
  it('renders trigger + tooltip bubble', () => {
    render(
      <Tooltip label="hint text">
        <button>trigger</button>
      </Tooltip>,
    )
    expect(screen.getByRole('tooltip')).toHaveTextContent('hint text')
  })

  it('tooltip starts hidden (opacity 0)', () => {
    render(
      <Tooltip label="hint">
        <button>trigger</button>
      </Tooltip>,
    )
    expect(screen.getByRole('tooltip').style.opacity).toBe('0')
  })
})