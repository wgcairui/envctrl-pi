/**
 * Tests for Toast — singleton manager with severity helpers.
 *
 * Coverage:
 *  - context throws when useToast called outside provider
 *  - success() / warn() / crit() / info() push entries with right severity
 *  - dismiss button removes the toast
 *  - viewport renders stacked toasts
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider, useToast } from '../../src/components/ui/Toast'

function Trigger({ trigger }: { trigger: 'success' | 'warn' | 'crit' | 'info' }) {
  const t = useToast()
  return <button onClick={() => t[trigger]('hi', 'there')}>fire</button>
}

function ReadCtxOutside() {
  // Should throw
  useToast()
  return null
}

describe('Toast', () => {
  it('throws when useToast is used outside the provider', () => {
    // Suppress React's error boundary noise
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ReadCtxOutside />)).toThrow(/ToastProvider/)
    spy.mockRestore()
  })

  it('renders a success toast via provider', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Trigger trigger="success" />
      </ToastProvider>,
    )
    await user.click(screen.getByText('fire'))
    const t = screen.getByTestId('toast')
    expect(t).toHaveAttribute('data-severity', 'ok')
    expect(t).toHaveTextContent('hi')
    expect(t).toHaveTextContent('there')
  })

  it('renders a warn toast', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Trigger trigger="warn" />
      </ToastProvider>,
    )
    await user.click(screen.getByText('fire'))
    expect(screen.getByTestId('toast')).toHaveAttribute('data-severity', 'warn')
  })

  it('renders a crit toast', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Trigger trigger="crit" />
      </ToastProvider>,
    )
    await user.click(screen.getByText('fire'))
    expect(screen.getByTestId('toast')).toHaveAttribute('data-severity', 'crit')
  })

  it('renders an info toast', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Trigger trigger="info" />
      </ToastProvider>,
    )
    await user.click(screen.getByText('fire'))
    expect(screen.getByTestId('toast')).toHaveAttribute('data-severity', 'info')
  })

  it('dismiss button removes the toast', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Trigger trigger="info" />
      </ToastProvider>,
    )
    await user.click(screen.getByText('fire'))
    expect(screen.getByTestId('toast')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByTestId('toast')).toBeNull()
  })

  it('viewport is present at all times', () => {
    render(
      <ToastProvider>
        <div>child</div>
      </ToastProvider>,
    )
    expect(screen.getByTestId('toast-viewport')).toBeInTheDocument()
  })

  it('stacks multiple toasts', async () => {
    const user = userEvent.setup()
    function Multi() {
      const t = useToast()
      return (
        <>
          <button onClick={() => t.success('one')}>1</button>
          <button onClick={() => t.success('two')}>2</button>
        </>
      )
    }
    render(
      <ToastProvider>
        <Multi />
      </ToastProvider>,
    )
    await user.click(screen.getByText('1'))
    await user.click(screen.getByText('2'))
    expect(screen.getAllByTestId('toast').length).toBe(2)
  })
})