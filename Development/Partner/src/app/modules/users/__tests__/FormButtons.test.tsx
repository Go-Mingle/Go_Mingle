import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { SaveButton, ModalFooter } from '../components/FormButtons'

describe('SaveButton', () => {
  it('renders disabled when invalid', () => {
    renderWithProviders(<SaveButton isValid={false} isEdit={false} onClick={() => {}} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('renders enabled, triggers click and hover', async () => {
    const onClick = vi.fn()
    renderWithProviders(<SaveButton isValid={true} isEdit={true} onClick={onClick} />)
    const btn = screen.getByRole('button')
    const user = userEvent.setup()
    await user.hover(btn)
    await user.unhover(btn)
    await user.click(btn)
    expect(onClick).toHaveBeenCalled()
  })
})

describe('ModalFooter', () => {
  it('triggers cancel and save', async () => {
    const onCancel = vi.fn()
    const onSave = vi.fn()
    renderWithProviders(<ModalFooter isValid isEdit={false} onSave={onSave} onCancel={onCancel} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
    await user.click(screen.getAllByRole('button')[1])
    expect(onSave).toHaveBeenCalled()
  })
})
