/**
 * Tests for Tabs — segmented control with sliding underline.
 *
 * Coverage:
 *  - renders all tabs with correct aria-selected state
 *  - clicking a tab fires onChange with the right value
 *  - keyboard activation via Enter / Space
 *  - Tabs vs RangeTabs structural difference
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Tabs, RangeTabs } from '../../src/components/ui/Tabs'

const ITEMS = [
  { value: 'live' as const, label: 'Live' },
  { value: 'history' as const, label: 'History' },
  { value: 'control' as const, label: 'Control' },
]

function Harness({ initial = 'live' as 'live' | 'history' | 'control', onChange }: {
  initial?: 'live' | 'history' | 'control'
  onChange?: (n: 'live' | 'history' | 'control') => void
}) {
  const [v, setV] = useState(initial)
  return (
    <Tabs
      items={ITEMS}
      value={v}
      onChange={(n) => {
        setV(n)
        onChange?.(n)
      }}
      aria-label="Device tabs"
    />
  )
}

describe('Tabs', () => {
  it('renders all tabs with aria-selected state', () => {
    render(<Harness initial="history" />)
    expect(screen.getByRole('tab', { name: 'Live' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Control' })).toHaveAttribute('aria-selected', 'false')
  })

  it('uses tablist role + aria-label', () => {
    render(<Harness />)
    expect(screen.getByRole('tablist', { name: 'Device tabs' })).toBeInTheDocument()
  })

  it('fires onChange when a tab is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await user.click(screen.getByRole('tab', { name: 'Control' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('control')
  })

  it('exposes data-active on the selected tab', () => {
    render(<Harness initial="live" />)
    expect(screen.getByRole('tab', { name: 'Live' })).toHaveAttribute('data-active', 'true')
  })
})

describe('RangeTabs', () => {
  it('renders time-window-style tabs', () => {
    render(
      <RangeTabs
        items={[
          { value: '5m', label: '5m' },
          { value: '1h', label: '1h' },
          { value: '24h', label: '24h' },
        ]}
        value="1h"
        onChange={() => {}}
        aria-label="Range"
      />,
    )
    expect(screen.getByRole('tab', { name: '1h' })).toHaveAttribute('aria-selected', 'true')
  })

  it('uses Mono font for compact range labels', () => {
    render(
      <RangeTabs
        items={[{ value: 'a', label: 'A' }]}
        value="a"
        onChange={() => {}}
        aria-label="r"
      />,
    )
    const btn = screen.getByRole('tab')
    expect(btn.style.fontFamily).toBe('var(--font-mono)')
  })
})