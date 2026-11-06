import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen } from '@testing-library/react'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { DashboardPage } from '../DashboardPage'

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 200 }}>{children}</div>
    ),
  }
})

describe('DashboardPage', () => {
  it('renders KPIs, widgets and charts', async () => {
    server.use(
      http.get('/api/dashboard/revenue-chart', () =>
        HttpResponse.json({ commissions: 10, penalties: 5, total: 15, trend: '+2%' }),
      ),
    )
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/\+2%/)).toBeInTheDocument()
  })
})
