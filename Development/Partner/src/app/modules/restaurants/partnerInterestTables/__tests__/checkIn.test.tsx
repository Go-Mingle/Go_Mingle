import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../../mocks/server'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { resetMockProfile, setMockProfileStatus } from '../../../../../mocks/data/partnerRestaurantProfile'
import {
  mockInterestTableBooking,
  resetMockInterestTables,
  setMockBookingSeats,
  setMockCheckInOpen,
} from '../../../../../mocks/data/partnerInterestTables'
import { PARTNER_IT_ENDPOINTS } from '../constants'
import { PartnerInterestTableDetailPage } from '../components/PartnerInterestTableDetailPage'

/**
 * "Guests Arrived" and no-show, through the real hooks and MSW.
 *
 * Both buttons are bound to flags the server sends (`canCheckIn`,
 * `canMarkNoShow`) and to the ACTIVE-only gate; the tests cover each side.
 */
async function renderLoaded(tab?: string) {
  const view = renderWithProviders(
    <Routes>
      <Route path="/interest-tables/:id" element={<PartnerInterestTableDetailPage />} />
    </Routes>,
    { route: `/interest-tables/it-1${tab ? `?tab=${tab}` : ''}` },
  )
  await screen.findByRole('heading', { level: 1 })
  return view
}

beforeEach(() => {
  resetMockProfile()
  setMockProfileStatus('ACTIVE')
  resetMockInterestTables()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
  Object.assign(navigator, { clipboard: { writeText: vi.fn() } })
})

describe('Guests Arrived', () => {
  it('is not offered before check-in opens', async () => {
    await renderLoaded()
    expect(screen.queryByRole('button', { name: 'Guests Arrived' })).not.toBeInTheDocument()
  })

  it('is not offered while the restaurant is not active', async () => {
    setMockCheckInOpen('it-1')
    setMockProfileStatus('PENDING')
    await renderLoaded()
    expect(screen.queryByRole('button', { name: 'Guests Arrived' })).not.toBeInTheDocument()
  })

  it('checks in every open booking and completes the table', async () => {
    setMockCheckInOpen('it-1')
    await renderLoaded('bookings')

    await userEvent.click(await screen.findByRole('button', { name: 'Guests Arrived' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Mark guests as arrived?')).toBeInTheDocument()
    expect(within(dialog).getByText(/card holds are released and the table is completed/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guests Arrived' }))

    expect(await screen.findByText(/checked in\. The table is completed\./)).toBeInTheDocument()
    await waitFor(() => expect(mockInterestTableBooking('bk-2')?.status).toBe('COMPLETED'))
    expect(mockInterestTableBooking('bk-2')?.attendance).toBe('ARRIVED')
    // The table is done: the button goes, and the rows say who came.
    // (Scoped to the header: the confirm dialog's own button lingers while it closes.)
    const header = screen.getByRole('heading', { level: 1 }).closest('.mb-4') as HTMLElement
    await waitFor(() => expect(within(header).queryByRole('button', { name: 'Guests Arrived' })).not.toBeInTheDocument())
    expect((await screen.findAllByText('Arrived')).length).toBeGreaterThan(0)
  })

  it('can be dismissed without checking anyone in', async () => {
    setMockCheckInOpen('it-1')
    await renderLoaded()
    await userEvent.click(await screen.findByRole('button', { name: 'Guests Arrived' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(mockInterestTableBooking('bk-2')?.status).toBe('CONFIRMED')
  })

  it("shows the server's reason when it refuses", async () => {
    setMockCheckInOpen('it-1')
    server.use(
      http.post(PARTNER_IT_ENDPOINTS.guestsArrived(':itId'), () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_TOO_EARLY', message: 'Guests can be checked in from one hour before the table starts.' } },
          { status: 409 },
        ),
      ),
    )
    await renderLoaded()
    await userEvent.click(await screen.findByRole('button', { name: 'Guests Arrived' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Guests Arrived' }))
    expect(await screen.findByText('Guests can be checked in from one hour before the table starts.')).toBeInTheDocument()
  })
})

describe('No-show', () => {
  it('is offered only on rows the server marks, and only while active', async () => {
    await renderLoaded('bookings')
    await screen.findByText('Parveen Rizvi')
    expect(screen.queryByLabelText(/record a no-show/i)).not.toBeInTheDocument()
  })

  it('is hidden while the restaurant is not active', async () => {
    setMockCheckInOpen('it-1')
    setMockProfileStatus('PENDING')
    await renderLoaded('bookings')
    await screen.findByText('Parveen Rizvi')
    expect(screen.queryByLabelText(/record a no-show/i)).not.toBeInTheDocument()
  })

  it('records some empty seats and shows the penalty collected', async () => {
    setMockCheckInOpen('it-1')
    setMockBookingSeats('bk-2', 3, 1500)
    await renderLoaded('bookings')

    await userEvent.click(await screen.findByLabelText('Record a no-show for Parveen Rizvi'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Record a no-show for “Parveen Rizvi”?')).toBeInTheDocument()
    // Starts at every seat: 3 × 1,500.
    expect(within(dialog).getByText(/Penalty to collect: PKR 4,500/)).toBeInTheDocument()
    const input = within(dialog).getByLabelText('Empty seats')
    await userEvent.clear(input)
    await userEvent.type(input, '2')
    await userEvent.tab()
    expect(within(dialog).getByText(/Penalty to collect: PKR 3,000/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'No-show' }))

    expect(await screen.findByText('No-show recorded.')).toBeInTheDocument()
    await waitFor(() => expect(mockInterestTableBooking('bk-2')?.attendance).toBe('PARTIAL'))
    expect(mockInterestTableBooking('bk-2')).toMatchObject({ emptySeats: 2, arrivedSeats: 1, penaltyChargedPkr: 3000 })
    expect(await screen.findByText('2 of 3 seats empty')).toBeInTheDocument()
    expect(screen.getByText(/PKR 3,000 penalty/)).toBeInTheDocument()
  })

  it('says so when no penalty applies, and records a full no-show', async () => {
    setMockCheckInOpen('it-1')
    setMockBookingSeats('bk-2', 2, 0)
    await renderLoaded('bookings')

    await userEvent.click(await screen.findByLabelText('Record a no-show for Parveen Rizvi'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('No penalty applies to this booking.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'No-show' }))

    await waitFor(() => expect(mockInterestTableBooking('bk-2')?.attendance).toBe('NO_SHOW'))
    expect(mockInterestTableBooking('bk-2')?.penaltyChargedPkr).toBe(0)
  })

  it('can be dismissed, and reports a refusal', async () => {
    setMockCheckInOpen('it-1')
    await renderLoaded('bookings')
    await userEvent.click(await screen.findByLabelText('Record a no-show for Parveen Rizvi'))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Close' }))
    expect(mockInterestTableBooking('bk-2')?.status).toBe('CONFIRMED')

    server.use(
      http.post(PARTNER_IT_ENDPOINTS.markNoShow(':bookingId'), () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_BOOKING_NOT_ACTIVE', message: 'This booking has already been checked in or cancelled.' } },
          { status: 409 },
        ),
      ),
    )
    await userEvent.click(await screen.findByLabelText('Record a no-show for Parveen Rizvi'))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'No-show' }))
    expect(await screen.findByText('This booking has already been checked in or cancelled.')).toBeInTheDocument()
  })

  it('shows a penalty that could not be collected', async () => {
    setMockCheckInOpen('it-1')
    server.use(
      http.get(PARTNER_IT_ENDPOINTS.bookings(':itId'), () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                bookingId: 'bk-9',
                bookingRef: 'GM-100009',
                minglerId: '',
                minglerName: 'Zain Malik',
                proMingler: { isProMingler: false, kind: 'NONE' },
                menuOption: '',
                date: '28-04-2026',
                billPkr: null,
                status: 'COMPLETED',
                cancellable: false,
                seats: 2,
                attendance: 'NO_SHOW',
                emptySeats: 2,
                penaltyPerSeatPkr: 1500,
                penaltyChargedPkr: 0,
                penaltyStatus: 'FAILED',
                canMarkNoShow: false,
              },
            ],
          },
        }),
      ),
    )
    await renderLoaded('bookings')
    expect(await screen.findByText('Penalty not collected yet')).toBeInTheDocument()
    expect(screen.getByText('No-show')).toBeInTheDocument()
  })

  it('shows what was collected when only some seats could be charged', async () => {
    server.use(
      http.get(PARTNER_IT_ENDPOINTS.bookings(':itId'), () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                bookingId: 'bk-9',
                bookingRef: 'GM-100009',
                minglerId: '',
                minglerName: 'Zain Malik',
                proMingler: { isProMingler: false, kind: 'NONE' },
                menuOption: '',
                date: '28-04-2026',
                billPkr: null,
                status: 'COMPLETED',
                cancellable: false,
                seats: 2,
                attendance: 'NO_SHOW',
                emptySeats: 2,
                penaltyPerSeatPkr: 1500,
                penaltyChargedPkr: 1500,
                penaltyStatus: 'FAILED',
                canMarkNoShow: false,
              },
            ],
          },
        }),
      ),
    )
    await renderLoaded('bookings')
    expect(await screen.findByText('Penalty not collected yet · PKR 1,500 collected so far')).toBeInTheDocument()
  })
})
