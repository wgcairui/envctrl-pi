/**
 * Tests for Modal — accessible dialog with backdrop + Esc close.
 *
 * Coverage:
 *  - hidden when open=false
 *  - portal mounts into document.body when open
 *  - role="dialog" + aria-modal="true"
 *  - Esc closes the modal
 *  - backdrop click closes (unless staticBackdrop)
 *  - body scroll locked while open
 *  - danger variant applies crit border
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Modal } from '../../src/components/ui/Modal'

function Harness({ danger = false, staticBackdrop = false }: { danger?: boolean; staticBackdrop?: boolean }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button onClick={() => setOpen(true)}>open</button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Title"
        description="desc"
        danger={danger}
        staticBackdrop={staticBackdrop}
        footer={<button onClick={() => setOpen(false)}>OK</button>}
      >
        body content
      </Modal>
    </>
  )
}

describe('Modal', () => {
  it('does not render when open=false', () => {
    function Wrapper() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          <Modal open={open} onClose={() => setOpen(false)} title="t" />
        </>
      )
    }
    render(<Wrapper />)
    expect(screen.queryByTestId('modal')).toBeNull()
  })

  it('renders as dialog with aria-modal', () => {
    render(<Harness />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('renders title and description', () => {
    render(<Harness />)
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument()
    expect(screen.getByText('desc')).toBeInTheDocument()
  })

  it('closes on Esc keypress', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByTestId('modal')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('modal')).toBeNull()
  })

  it('closes on backdrop click (default)', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const backdrop = screen.getByTestId('modal-backdrop')
    await user.click(backdrop)
    expect(screen.queryByTestId('modal')).toBeNull()
  })

  it('does not close on backdrop click when staticBackdrop=true', async () => {
    const user = userEvent.setup()
    render(<Harness staticBackdrop />)
    await user.click(screen.getByTestId('modal-backdrop'))
    expect(screen.getByTestId('modal')).toBeInTheDocument()
  })

  it('locks body scroll while open', () => {
    render(<Harness />)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores body scroll on close', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(document.body.style.overflow).toBe('hidden')
    await user.keyboard('{Escape}')
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('applies danger styling when danger=true', () => {
    render(<Harness danger />)
    const dialog = screen.getByTestId('modal')
    expect(dialog).toHaveAttribute('data-danger', 'true')
    expect(dialog.style.border).toContain('var(--crit-border)')
  })

  it('renders Close button with aria-label', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})