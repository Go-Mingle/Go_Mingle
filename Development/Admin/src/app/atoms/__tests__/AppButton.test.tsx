import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { AppButton } from '../AppButton'

describe('AppButton', () => {
  it('renders its children', () => {
    renderWithProviders(<AppButton>Save</AppButton>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('shows a spinner and disables the button when loading', () => {
    renderWithProviders(<AppButton loading>Save</AppButton>)
    const btn = screen.getByRole('button', { name: /save/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(btn.querySelector('.animate-spin')).toBeTruthy()
  })

  it('does not fire onClick while loading (prevents double-submit)', async () => {
    const onClick = vi.fn()
    renderWithProviders(
      <AppButton loading onClick={onClick}>
        Save
      </AppButton>,
    )
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('is disabled when disabled prop is set, without a spinner', () => {
    renderWithProviders(<AppButton disabled>Save</AppButton>)
    const btn = screen.getByRole('button', { name: /save/i })
    expect(btn).toBeDisabled()
    expect(btn.querySelector('.animate-spin')).toBeNull()
  })
})
