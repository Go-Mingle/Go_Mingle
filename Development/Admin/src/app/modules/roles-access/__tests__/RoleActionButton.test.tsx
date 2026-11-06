import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoleActionButton } from '../components/RoleActionButton'

describe('RoleActionButton', () => {
  it('triggers onClick and handles hover/leave', async () => {
    const onClick = vi.fn()
    const { container } = render(
      <RoleActionButton tooltip="Edit" hoverBg="red" hoverColor="blue" onClick={onClick}>
        child
      </RoleActionButton>,
    )
    const div = container.querySelector('div')!
    const user = userEvent.setup()
    await user.hover(div)
    await user.unhover(div)
    await user.click(div)
    expect(onClick).toHaveBeenCalled()
  })
})
