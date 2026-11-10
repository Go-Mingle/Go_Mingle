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
})
