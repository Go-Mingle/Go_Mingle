import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { BrandPanel } from '../components/BrandPanel'

describe('BrandPanel', () => {
  it('renders the brand logo', () => {
    renderWithProviders(<BrandPanel />)
    expect(screen.getByRole('img', { name: 'GoMingle' })).toBeInTheDocument()
  })

  it('speaks to restaurant owners, not GoMingle staff', () => {
    renderWithProviders(<BrandPanel />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Fill your tables')
    expect(
      screen.getByText('Payments held in escrow, paid out after each dinner'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/operations hub/i)).not.toBeInTheDocument()
  })
})
