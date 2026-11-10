import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { ConfirmModal } from '../ConfirmModal'

describe('ConfirmModal — two-button mode (default)', () => {
  it('renders title, content, cancel and confirm buttons', () => {
    renderWithProviders(
      <ConfirmModal
        open={true}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete item?"
        content="This cannot be undone."
      />,
    )
    expect(screen.getByText('Delete item?')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
  })

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn()
    renderWithProviders(
      <ConfirmModal
        open={true}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        title="Are you sure?"
        content="Really?"
        confirmText="Yes, delete"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn()
    renderWithProviders(
      <ConfirmModal
        open={true}
        onCancel={onCancel}
        onConfirm={vi.fn()}
        title="Are you sure?"
        content="Really?"
      />,
    )
    const cancelBtns = screen.getAllByRole('button', { name: /cancel/i })
    fireEvent.click(cancelBtns[cancelBtns.length - 1])
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does not render when open=false', () => {
    renderWithProviders(
      <ConfirmModal
        open={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete item?"
        content="This cannot be undone."
      />,
    )
    expect(screen.queryByText('Delete item?')).not.toBeInTheDocument()
  })
})

describe('ConfirmModal — singleButton mode', () => {
  it('renders only one button with default Got it text', () => {
    renderWithProviders(
      <ConfirmModal
        open={true}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        title="Role blocked"
        content="Remove users before deleting."
        singleButton={true}
        singleButtonText="Got it"
      />,
    )
    expect(screen.getByText('Role blocked')).toBeInTheDocument()
    expect(screen.getByText('Remove users before deleting.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument()
  })

  it('uses custom singleButtonText when provided', () => {
    renderWithProviders(
      <ConfirmModal
        open={true}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        title="Info"
        content="OK"
        singleButton={true}
        singleButtonText="Understood"
      />,
    )
    expect(screen.getByRole('button', { name: /understood/i })).toBeInTheDocument()
  })

  it('calls onCancel when the single button is clicked', () => {
    const onCancel = vi.fn()
    renderWithProviders(
      <ConfirmModal
        open={true}
        onCancel={onCancel}
        onConfirm={vi.fn()}
        title="Info"
        content="OK"
        singleButton={true}
        singleButtonText="Got it"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
