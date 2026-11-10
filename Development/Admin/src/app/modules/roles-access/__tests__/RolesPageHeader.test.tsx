import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RolesPageHeader } from '../components/RolesPageHeader'

describe('RolesPageHeader', () => {
  it('renders and triggers onNew with hover', async () => {
    const onNew = vi.fn()
    render(<RolesPageHeader onNew={onNew} />)
    const btn = screen.getByRole('button')
    const user = userEvent.setup()
    await user.hover(btn)
    await user.unhover(btn)
    await user.click(btn)
    expect(onNew).toHaveBeenCalled()
  })
})
