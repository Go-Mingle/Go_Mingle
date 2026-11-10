import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { BrandPanel } from '../components/BrandPanel'

describe('BrandPanel', () => {
  it('renders the GoMingle logo lockup', () => {
    renderWithProviders(<BrandPanel />)
    const logo = screen.getByAltText('GoMingle')
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('src', expect.stringContaining('gomingle-logo-light'))
  })

  it('renders the tagline and chips', () => {
    renderWithProviders(<BrandPanel />)
    expect(screen.getByText('Elevated')).toBeInTheDocument()
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByText('Effortless')).toBeInTheDocument()
  })
})
