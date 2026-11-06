import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { InterestTableStatusBadge } from '../components/InterestTableStatusBadge'
import { INTEREST_TABLE_STATUS_COLORS } from '../constants'
import type { InterestTableStatus } from '../types'

describe('InterestTableStatusBadge', () => {
  const statuses: InterestTableStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']

  it.each(statuses)('renders the translated label and mapped color for %s', (status) => {
    renderWithProviders(<InterestTableStatusBadge status={status} />)
    const expectedLabel = status.charAt(0) + status.slice(1).toLowerCase()
    const badge = screen.getByText(expectedLabel)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveStyle({ background: INTEREST_TABLE_STATUS_COLORS[status] })
  })

  it('falls back to the neutral color for an unmapped status', () => {
    const unknownStatus = 'UNKNOWN' as InterestTableStatus
    renderWithProviders(<InterestTableStatusBadge status={unknownStatus} />)
    const badge = screen.getByText('status.unknown')
    expect(badge).toHaveStyle({ background: 'var(--color-text-secondary)' })
  })
})
