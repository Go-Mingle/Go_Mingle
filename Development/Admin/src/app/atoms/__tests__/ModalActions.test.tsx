import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { ModalActions } from '../ModalActions'

describe('ModalActions', () => {
  it('confirm button shows loading state when isLoading is true', () => {
    renderWithProviders(<ModalActions isLoading={true} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[1]).toHaveAttribute('aria-busy', 'true')
  })

  it('confirm button is disabled when confirmDisabled is true', () => {
    renderWithProviders(<ModalActions confirmDisabled={true} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[1]).toBeDisabled()
  })
})
