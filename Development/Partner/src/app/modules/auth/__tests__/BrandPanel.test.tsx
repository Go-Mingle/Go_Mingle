import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { BrandPanel } from '../components/BrandPanel'

describe('BrandPanel', () => {
  it('renders the brand logo', () => {
    renderWithProviders(<BrandPanel />)
    expect(screen.getByAltText('GoMingle')).toBeInTheDocument()
  })
})
