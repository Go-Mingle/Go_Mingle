import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import type { Insights } from '../../../visual/insights'
import { DashboardPage } from '../DashboardPage'

const URL = '*/api/v1/partner/dashboard'

function insights(days: number, over: Partial<Insights> = {}): Insights {
  const daily = Array.from({ length: days }, (_, i) => ({
    date: `2026-11-${String(i + 1).padStart(2, '0')}`,
    bookings: i === days - 1 ? 2 : 0,
    seats: i === days - 1 ? 5 : 0,
    collectedPkr: 0,
    paidOutPkr: i === days - 1 ? 9240 : 0,
    feesPkr: i === days - 1 ? 1260 : 0,
  }))
  return {
    days,
    from: daily[0].date,
    to: daily[days - 1].date,
    kpis: {
      bookings: { value: 2, previous: 1 },
      seats: { value: 5, previous: 0 },
      collectedPkr: { value: 18900, previous: 0 },
      paidOutPkr: { value: 9240, previous: 0 },
      feesPkr: { value: 1260, previous: 0 },
      upcomingTables: 1,
      upcomingSeats: { booked: 5, capacity: 8 },
    },
    daily,
    outcome: { upcoming: 2, arrived: 0, partial: 0, noShow: 0, cancelled: 0 },
    escrow: { heldPkr: 14000, inEscrowPkr: 8400, paidOutPkr: 9240, refundedPkr: 4200, feePct: 12 },
    upcoming: [
      {
        id: 'it-1',
        name: 'Startup Mixer',
        restaurantId: 'r1',
        restaurantName: 'Kolachi Seafront',
        startsAt: '2026-11-27T14:30:00.000Z',
        maxGuests: 8,
        bookedSeats: 5,
      },
    ],
    ...over,
  }
}

beforeEach(() => {
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('Partner DashboardPage', () => {
  it("shows the restaurant's own figures", async () => {
    server.use(http.get(URL, () => HttpResponse.json(insights(30))))
    const { container } = renderWithProviders(<DashboardPage />)
    expect(container.querySelector('.gm-skeleton')).toBeInTheDocument()

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('How your interest tables are doing.')).toBeInTheDocument()
    expect(screen.getAllByLabelText('PKR 9,240').length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('PKR 8,400').length).toBeGreaterThan(0)
    expect(screen.getByText('+100%')).toBeInTheDocument()
    expect(screen.getAllByText('Paid to you').length).toBeGreaterThan(0)
    // The platform-only parts stay out of a restaurant's view.
    expect(screen.queryByText('Top restaurants')).not.toBeInTheDocument()
    expect(screen.queryByText('GoMingle fees earned')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Startup Mixer/ })).toHaveAttribute(
      'href',
      '/interest-tables/it-1',
    )
  })

  it('asks for the period picked', async () => {
    const asked: string[] = []
    server.use(
      http.get(URL, ({ request }) => {
        const days = new globalThis.URL(request.url).searchParams.get('days') ?? ''
        asked.push(days)
        return HttpResponse.json(insights(Number(days)))
      }),
    )
    renderWithProviders(<DashboardPage />)
    const period = await screen.findByLabelText('Period')
    await userEvent.click(within(period).getByText('90 days'))
    await waitFor(() => expect(asked).toEqual(['30', '90']))
  })

  it('handles a restaurant with nothing yet', async () => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json(
          insights(7, {
            kpis: {
              bookings: { value: 0, previous: 0 },
              seats: { value: 0, previous: 0 },
              collectedPkr: { value: 0, previous: 0 },
              paidOutPkr: { value: 0, previous: 0 },
              feesPkr: { value: 0, previous: 0 },
              upcomingTables: 0,
              upcomingSeats: { booked: 0, capacity: 0 },
            },
            outcome: { upcoming: 0, arrived: 0, partial: 0, noShow: 0, cancelled: 0 },
            upcoming: [],
          }),
        ),
      ),
    )
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByText('No bookings in this period yet.')).toBeInTheDocument()
    expect(
      screen.getByText('No interest tables are scheduled yet. GoMingle sets them up with you.'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('No activity yet').length).toBeGreaterThan(0)
  })

  it('offers a retry when the dashboard cannot load', async () => {
    let calls = 0
    server.use(
      http.get(URL, () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json({ message: 'down' }, { status: 400 })
          : HttpResponse.json(insights(30))
      }),
    )
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByText('The dashboard could not be loaded.', {}, { timeout: 8000 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })
})
