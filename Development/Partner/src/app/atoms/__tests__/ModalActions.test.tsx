import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { PrimaryActionButton, SecondaryActionButton } from '../ModalActions'

describe('PrimaryActionButton', () => {
  it('renders the primary variant by default and forwards children and clicks', async () => {
    const onClick = vi.fn()
    renderWithProviders(<PrimaryActionButton onClick={onClick}>Save</PrimaryActionButton>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn.className).toContain('bg-[var(--color-accent)]')
    await userEvent.setup().click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders the danger variant when danger is set', () => {
    renderWithProviders(<PrimaryActionButton danger>Delete</PrimaryActionButton>)
    const btn = screen.getByRole('button', { name: 'Delete' })
    expect(btn.className).toContain('bg-[var(--color-error-bg)]')
    expect(btn.className).not.toContain('bg-[var(--color-accent)]')
  })

  it('forwards native button attributes such as disabled and type', () => {
    renderWithProviders(
      <PrimaryActionButton disabled type="submit">
        Confirm
      </PrimaryActionButton>,
    )
    const btn = screen.getByRole('button', { name: 'Confirm' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('type', 'submit')
  })
})

describe('SecondaryActionButton', () => {
  it('renders the neutral variant by default and forwards clicks', async () => {
    const onClick = vi.fn()
    renderWithProviders(<SecondaryActionButton onClick={onClick}>Cancel</SecondaryActionButton>)
    const btn = screen.getByRole('button', { name: 'Cancel' })
    expect(btn.className).toContain('bg-[var(--color-card)]')
    await userEvent.setup().click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders the danger variant when danger is set', () => {
    renderWithProviders(<SecondaryActionButton danger>Decline</SecondaryActionButton>)
    const btn = screen.getByRole('button', { name: 'Decline' })
    expect(btn.className).toContain('bg-[var(--color-error-bg)]')
    expect(btn.className).not.toContain('bg-[var(--color-card)]')
  })
})
