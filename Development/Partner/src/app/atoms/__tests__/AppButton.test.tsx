import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { AppButton, type AppButtonVariant } from '../AppButton'

describe('AppButton', () => {
  it('uses the 12px radius (rounded-lg), not the 16px rounded-xl', () => {
    renderWithProviders(<AppButton>Save</AppButton>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn.className).toContain('rounded-lg')
    expect(btn.className).not.toContain('rounded-xl')
  })

  it.each<[AppButtonVariant, string]>([
    ['primary', 'bg-[var(--color-accent)]'],
    ['secondary', 'bg-[var(--color-accent-light)]'],
    ['danger', 'bg-[var(--color-error-bg)]'],
    ['neutral', 'bg-[var(--color-card)]'],
  ])('renders the %s variant fill', (variant, expectedClass) => {
    renderWithProviders(<AppButton variant={variant}>Action</AppButton>)
    const btn = screen.getByRole('button', { name: 'Action' })
    expect(btn.className).toContain(expectedClass)
    // Radius is consistent across every variant.
    expect(btn.className).toContain('rounded-lg')
  })

  it('applies the hover restyle only when enabled', () => {
    const { rerender } = renderWithProviders(<AppButton variant="primary">Hover</AppButton>)
    expect(screen.getByRole('button', { name: 'Hover' }).className).toContain(
      'md:hover:bg-[var(--color-accent-dark)]',
    )
    rerender(
      <AppButton variant="primary" disabled>
        Hover
      </AppButton>,
    )
    expect(screen.getByRole('button', { name: 'Hover' }).className).not.toContain(
      'md:hover:bg-[var(--color-accent-dark)]',
    )
  })

  it('adds flex-1 when fillContainer is set', () => {
    const { rerender } = renderWithProviders(<AppButton>Fit</AppButton>)
    expect(screen.getByRole('button', { name: 'Fit' }).className).not.toContain('flex-1')
    rerender(<AppButton fillContainer>Fit</AppButton>)
    expect(screen.getByRole('button', { name: 'Fit' }).className).toContain('flex-1')
  })

  it('forwards clicks, native attributes, disabled state, and custom className', async () => {
    const onClick = vi.fn()
    renderWithProviders(
      <AppButton type="submit" className="custom-x" onClick={onClick}>
        Confirm
      </AppButton>,
    )
    const btn = screen.getByRole('button', { name: 'Confirm' })
    expect(btn).toHaveAttribute('type', 'submit')
    expect(btn.className).toContain('custom-x')
    await userEvent.setup().click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire click handlers while disabled', async () => {
    const onClick = vi.fn()
    renderWithProviders(
      <AppButton disabled onClick={onClick}>
        Nope
      </AppButton>,
    )
    const btn = screen.getByRole('button', { name: 'Nope' })
    expect(btn).toBeDisabled()
    await userEvent.setup().click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })
})
