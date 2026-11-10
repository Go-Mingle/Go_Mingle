import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { ChangeProminglerModal } from '../components/ChangeProminglerModal'

const candidates = [
  { id: 'p1', name: 'Current Bob', phone: '111' },
  { id: 'p2', name: 'Carol', phone: '222' },
  { id: 'p3', name: 'Dave', phone: '333' },
]

describe('ChangeProminglerModal', () => {
  it('shows the current promingler label (not the id) and confirms a different selection', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <ChangeProminglerModal
        open
        candidates={candidates}
        currentId="p1"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    // The preselected current promingler shows its "name — phone" label, not the raw id.
    expect(screen.getByText('Current Bob — 111')).toBeInTheDocument()
    expect(screen.queryByText('p1')).toBeNull()
    // Confirm stays disabled until a *different* candidate is chosen.
    expect(screen.getByRole('button', { name: /change promingler/i })).toBeDisabled()
    fireEvent.mouseDown(screen.getByRole('combobox'))
    await user.click(await screen.findByText('Carol — 222'))
    const confirm = screen.getByRole('button', { name: /change promingler/i })
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('p2')
  })

  it('keeps confirm disabled until a candidate is chosen', () => {
    renderWithProviders(
      <ChangeProminglerModal open candidates={candidates} onClose={vi.fn()} onConfirm={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /change promingler/i })).toBeDisabled()
  })

  it('closes via cancel', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <ChangeProminglerModal open candidates={candidates} onClose={onClose} onConfirm={vi.fn()} />,
    )
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
