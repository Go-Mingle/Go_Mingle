import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { TableLoader } from '../TableLoader'

describe('TableLoader', () => {
  it('announces what is loading and draws a table with six seats', () => {
    const { container } = renderWithProviders(<TableLoader label="Loading bookings" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading bookings')
    expect(container.querySelectorAll('.gm-loader-seat')).toHaveLength(6)
  })

  it('keeps the label for screen readers only when quiet', () => {
    renderWithProviders(<TableLoader label="Loading" quiet />)
    expect(screen.getByText('Loading')).toHaveClass('sr-only')
  })
})
