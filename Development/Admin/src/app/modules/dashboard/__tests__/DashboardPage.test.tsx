import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { DashboardPage } from '../DashboardPage'
import { mockDashboardOverview } from '../../../../mocks/data/dashboard'

const URL = '*/api/dashboard/overview'

describe('Admin DashboardPage', () => {
  it('shows the platform figures from the API', async () => {
    const data = mockDashboardOverview(30)
    server.use(http.get(URL, () => HttpResponse.json({ success: true, data })))
    renderWithProviders(<DashboardPage />)

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Bookings and money across every restaurant.')).toBeInTheDocument()
    expect(screen.getByText('Collected from Minglers')).toBeInTheDocument()
    expect(screen.getByText('GoMingle fees earned')).toBeInTheDocument()
    // Totals are shown in full, by their accessible names.
    expect(screen.getByLabelText(String(data.kpis.bookings.value))).toBeInTheDocument()
    // Restaurant counts and the top restaurants list are the admin-only parts.
    expect(screen.getByText('7 active restaurants')).toBeInTheDocument()
    expect(screen.getByText('5 waiting for approval')).toBeInTheDocument()
    expect(screen.getByText('Top restaurants')).toBeInTheDocument()
    expect(screen.getAllByText('Tuscany Courtyard').length).toBeGreaterThan(0)
    // Upcoming tables link to the interest table.
    const link = screen.getAllByRole('link', { name: /Startup Mixer/ })[0]
    expect(link).toHaveAttribute('href', '/interest-tables/it-1')
  })

  it('asks the API for the period picked', async () => {
    const asked: string[] = []
    server.use(
      http.get(URL, ({ request }) => {
        const days = new globalThis.URL(request.url).searchParams.get('days') ?? ''
        asked.push(days)
        return HttpResponse.json({ success: true, data: mockDashboardOverview(Number(days)) })
      }),
    )
    renderWithProviders(<DashboardPage />)
    const period = await screen.findByLabelText('Period')
    await userEvent.click(within(period).getByText('7 days'))
    await waitFor(() => expect(asked).toEqual(['30', '7']))
    expect(await screen.findByText('By what Minglers paid in the last 7 days.')).toBeInTheDocument()
  })

  it('offers a retry when the dashboard cannot load', async () => {
    let calls = 0
    server.use(
      http.get(URL, () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json({ message: 'down' }, { status: 500 })
          : HttpResponse.json({ success: true, data: mockDashboardOverview(30) })
      }),
    )
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByText('The dashboard could not be loaded.', {}, { timeout: 5000 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Collected from Minglers')).toBeInTheDocument()
  })
})
