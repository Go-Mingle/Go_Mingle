import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { BrandPanel } from '../components/BrandPanel'

describe('BrandPanel', () => {
  it('renders the light logo lockup and the animated table mark', () => {
    const { container } = renderWithProviders(<BrandPanel />)
    expect(screen.getByRole('img', { name: 'GoMingle' })).toHaveClass('gm-wordmark--light')
    expect(container.querySelector('.gm-mark--animated')).not.toBeNull()
  })

  it('says what the admin panel is for', () => {
    renderWithProviders(<BrandPanel />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Every table, every seat, at a glance.',
    )
    expect(screen.getByText('Approve and manage every restaurant')).toBeInTheDocument()
    expect(
      screen.getByText('Hold payments in escrow until each dinner is done'),
    ).toBeInTheDocument()
    expect(screen.getByText('Tune interests, amenities and timers')).toBeInTheDocument()
  })
})
