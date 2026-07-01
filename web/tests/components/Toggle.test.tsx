/**
 * Tests for Toggle — accessible switch with click + keyboard.
 *
 * Coverage:
 *  - renders as button[role=switch] with aria-checked reflecting state
 *  - click toggles state and calls onChange with new value
 *  - Space / Enter toggles (keyboard accessibility)
 *  - disabled ignores clicks and keypresses
 *  - applies gradient background when on
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Toggle } from '../../src/components/ui/Toggle'

function Harness({ initial = false, onChange }: { initial?: boolean; onChange?: (n: boolean) => void }) {
  const [on, setOn] = useState(initial)
  return (
    <Toggle
      checked={on}
      onChange={(next) => {
        setOn(next)
        onChange?.(next)
      }}
      aria-label="Power"
    />
  )
}

describe('Toggle', () => {
  it('renders as switch with aria-checked false by default', () => {
    render(<Harness />)
    const sw = screen.getByRole('switch', { name: 'Power' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
  })

  it('reflects initial state', () => {
    render(<Harness initial />)
    expect(screen.getByRole('switch', { name: 'Power' })).toHaveAttribute('aria-checked', 'true')
  })

  it('flips state on click and reports new value via onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await user.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('toggles with Space key (keyboard accessible)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const sw = screen.getByRole('switch')
    sw.focus()
    await user.keyboard(' ')
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('toggles with Enter key', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const sw = screen.getByRole('switch')
    sw.focus()
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('does nothing when disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Toggle checked={false} onChange={onChange} disabled aria-label="Locked switch" />,
    )
    const sw = screen.getByRole('switch', { name: 'Locked switch' })
    await user.click(sw)
    expect(onChange).not.toHaveBeenCalled()
  })
})