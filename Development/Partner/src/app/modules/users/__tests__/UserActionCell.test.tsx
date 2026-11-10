import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserActionCell } from '../components/UserActionCell'

describe('UserActionCell', () => {
  it('triggers all handlers and hovers', async () => {
    const onEdit = vi.fn()
    const onResetPassword = vi.fn()
    const onDelete = vi.fn()
    const { container } = render(
      <UserActionCell onEdit={onEdit} onResetPassword={onResetPassword} onDelete={onDelete} />,
    )
    const divs = Array.from(container.querySelectorAll('div')).filter((d) => d.querySelector('svg'))
    const innerMost = divs
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
      .slice(0, 3)
    const user = userEvent.setup()
    for (const d of innerMost) {
      await user.hover(d)
      await user.unhover(d)
      fireEvent.click(d)
    }
    expect(onEdit).toHaveBeenCalled()
    expect(onResetPassword).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalled()
  })

  it('activates each action via the keyboard (Enter/Space) and ignores other keys', () => {
    const onEdit = vi.fn()
    const onResetPassword = vi.fn()
    const onDelete = vi.fn()
    render(<UserActionCell onEdit={onEdit} onResetPassword={onResetPassword} onDelete={onDelete} />)
    const [editBtn, resetBtn, deleteBtn] = Array.from(
      document.querySelectorAll('[role="button"]'),
    ) as HTMLElement[]

    editBtn.focus()
    fireEvent.keyDown(editBtn, { key: 'Enter' })
    expect(onEdit).toHaveBeenCalledTimes(1)

    resetBtn.focus()
    fireEvent.keyDown(resetBtn, { key: ' ' })
    expect(onResetPassword).toHaveBeenCalledTimes(1)

    deleteBtn.focus()
    fireEvent.keyDown(deleteBtn, { key: 'Enter' })
    expect(onDelete).toHaveBeenCalledTimes(1)

    // A non-activating key must not fire any callback again.
    fireEvent.keyDown(deleteBtn, { key: 'ArrowDown' })
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('withholds only the delete control when canDelete is false (BR-03)', () => {
    render(
      <UserActionCell
        canDelete={false}
        onEdit={() => {}}
        onResetPassword={() => {}}
        onDelete={() => {}}
      />,
    )
    const buttons = document.querySelectorAll('[role="button"]')
    expect(buttons).toHaveLength(2)
    expect(document.querySelector('[aria-label="Delete"]')).toBeNull()
    // Edit and set-password stay available on the primary user's row.
    expect(document.querySelector('[aria-label="Edit"]')).toBeInTheDocument()
    expect(document.querySelector('[aria-label="Set new password"]')).toBeInTheDocument()
  })
})
