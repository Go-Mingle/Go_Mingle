import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { FinancesEmptyState } from '../components/FinancesEmptyState'

describe('FinancesEmptyState', () => {
  it('renders the title and message', () => {
    renderWithProviders(<FinancesEmptyState />)
    expect(screen.getByText('All caught up')).toBeInTheDocument()
    expect(screen.getByText(/No transactions have been recorded yet/i)).toBeInTheDocument()
  })

  it('swaps to the period-scoped message when a date range is applied', () => {
    renderWithProviders(<FinancesEmptyState dateFiltered />)
    expect(screen.getByText('All caught up')).toBeInTheDocument()
    expect(screen.getByText(/No transactions for this period yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/No transactions have been recorded yet/i)).not.toBeInTheDocument()
  })
})
