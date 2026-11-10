import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { KpiCard } from '../KpiCard'

const baseProps = {
  label: 'Label',
  icon: <span>icon</span>,
  valueByPeriod: { today: 1, thisWeek: 10, thisMonth: 100 },
  trendByPeriod: { today: 'T', thisWeek: 'W', thisMonth: 'M' },
}

describe('KpiCard', () => {
  it('renders default thisWeek value', () => {
    renderWithProviders(<KpiCard {...baseProps} />)
    expect(screen.getByText('Label')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('W')).toBeInTheDocument()
  })

  it('renders muted trend variant', () => {
    renderWithProviders(<KpiCard {...baseProps} trendColor="muted" />)
    expect(screen.getByText('W')).toBeInTheDocument()
  })

  it('switches period on segmented change', async () => {
    renderWithProviders(<KpiCard {...baseProps} />)
    const user = userEvent.setup()
    const todayBtn = screen.getByText(/today/i)
    await user.click(todayBtn)
    expect(screen.getByText('1')).toBeInTheDocument()
    const monthBtn = screen.getByText(/this month/i)
    await user.click(monthBtn)
    expect(screen.getByText('100')).toBeInTheDocument()
  })
})
