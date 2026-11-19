import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { BrandPanel } from '../components/BrandPanel'

describe('BrandPanel', () => {
  it('renders the brand logo and the animated table mark', () => {
    const { container } = renderWithProviders(<BrandPanel />)
    expect(screen.getByRole('img', { name: 'GoMingle' })).toBeInTheDocument()
    expect(container.querySelector('.gm-mark--animated')).not.toBeNull()
  })

  it('speaks to restaurant owners, not GoMingle staff', () => {
    renderWithProviders(<BrandPanel />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Fill your tables with people who came to talk.',
    )
    expect(screen.queryByText(/operations hub/i)).not.toBeInTheDocument()
  })

  it('shows tables of different sizes, not just four-tops', () => {
    renderWithProviders(<BrandPanel />)
    const floor = within(
      screen.getByRole('region', { name: 'What your floor could look like tonight' }),
    )
    expect(floor.getByText(/Table for 2/)).toBeInTheDocument()
    expect(floor.getByText(/Table for 6/)).toBeInTheDocument()
    expect(floor.getByText(/Table for 10/)).toBeInTheDocument()
    expect(floor.getByText('Full')).toBeInTheDocument()
    expect(floor.getByText('2 seats open')).toBeInTheDocument()
    expect(floor.getByText('7 seats open')).toBeInTheDocument()
  })
})
