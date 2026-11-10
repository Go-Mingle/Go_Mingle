import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { DashboardCharts } from '../DashboardCharts'

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 200 }}>{children}</div>
    ),
  }
})

describe('DashboardCharts', () => {
  it('renders without revenueData (no pie)', () => {
    renderWithProviders(<DashboardCharts />)
    expect(screen.getByText(/bookings/i)).toBeInTheDocument()
  })

  it('renders with revenueData (pie + total badge)', () => {
    renderWithProviders(
      <DashboardCharts
        revenueData={{ commissions: 100, penalties: 50, total: 150, trend: '+5%' }}
      />,
    )
    expect(screen.getByText(/\+5%/)).toBeInTheDocument()
  })
})
