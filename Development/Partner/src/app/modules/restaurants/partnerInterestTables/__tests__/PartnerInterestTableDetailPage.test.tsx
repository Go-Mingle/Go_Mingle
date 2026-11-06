import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../../../../mocks/server'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../mocks/data/partnerRestaurantProfile'
import {
  mockInterestTableBooking,
  mockInvitee,
  resetMockInterestTables,
} from '../../../../../mocks/data/partnerInterestTables'
import { PARTNER_IT_ENDPOINTS } from '../constants'
import { PartnerInterestTableDetailPage } from '../components/PartnerInterestTableDetailPage'

/**
 * Driven through the real hooks and MSW rather than a stubbed controller.
 *
 * The behaviours worth protecting on this page are all integration-shaped — the
 * Invited tab appearing only for an Invite Only table, the × obeying both
 * `cancellable` and the ACTIVE gate, a Draft id rendering "not found" — and a stub
 * would let them pass while the wiring was wrong.
 */
function renderDetail(itId = 'it-1', tab?: string) {
  const route = `/interest-tables/${itId}${tab ? `?tab=${tab}` : ''}`
  return renderWithProviders(
    <Routes>
      <Route path="/interest-tables/:id" element={<PartnerInterestTableDetailPage />} />
    </Routes>,
    { route },
  )
}

async function renderLoaded(itId = 'it-1', tab?: string) {
  const view = renderDetail(itId, tab)
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

describe('detail page — states', () => {
  it('spins, then shows the table', async () => {
    const { container } = renderDetail()
    expect(container.querySelector('.ant-spin')).toBeInTheDocument()

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Friday Wine Evening',
    )
  })

  it.each([['it-draft'], ['it-nope']])(
    'renders "not found" for %s rather than an error panel',
    async (itId) => {
      renderDetail(itId)

      // A Draft table 404s by design (BR-03), and so does another restaurant's — both
      // are expected outcomes, not failures.
      expect(await screen.findByText('Interest table not found')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    },
  )
})

describe('detail page — the header is read-only (BR-02)', () => {
  it('offers no table-modifying action at all', async () => {
    await renderLoaded()

    for (const name of [
      /publish/i,
      /^edit$/i,
      /delete/i,
      /make available/i,
      /change pro ?mingler/i,
      /cancel table/i,
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  it('copies the link when the server says it is eligible', async () => {
    await renderLoaded()

    await userEvent.click(screen.getByRole('button', { name: /copy link/i }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('/m/interest-tables/it-1'),
    )
    expect(await screen.findByText('Link copied.')).toBeInTheDocument()
  })

  it('hides Copy Link when the server says it is not eligible', async () => {
    // Bound to `copyLinkEligible`, never derived from the status.
    await renderLoaded('it-cancelled')

    expect(screen.queryByRole('button', { name: /copy link/i })).not.toBeInTheDocument()
  })
})

describe('detail page — the Invited tab gate (BR-06)', () => {
  it('shows the Invited tab for an Invite Only table', async () => {
    await renderLoaded()

    expect(await screen.findByRole('tab', { name: 'Invited' })).toBeInTheDocument()
  })

  it('omits it entirely for a public table, rather than showing an empty state', async () => {
    await renderLoaded('it-open')

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('tab', { name: 'Invited' })).not.toBeInTheDocument()
  })

  it('always shows the other three tabs', async () => {
    await renderLoaded('it-open')

    for (const name of ['Overview', 'Bookings', 'Menu Options']) {
      expect(await screen.findByRole('tab', { name })).toBeInTheDocument()
    }
  })
})

describe('detail page — Overview', () => {
  it('renders the contract fields without recomputing them', async () => {
    await renderLoaded()

    expect(screen.getByText('Wine & Dine')).toBeInTheDocument()
    expect(screen.getByText('Terrace')).toBeInTheDocument()
    // 120 minutes as 2h, and seatsLeft straight from the server.
    expect(screen.getByText('2h')).toBeInTheDocument()
    expect(screen.getByText('Seats Left')).toBeInTheDocument()
  })

  it('renders the pre-formatted date verbatim', async () => {
    await renderLoaded()

    expect(screen.getAllByText('28-04-2026').length).toBeGreaterThan(0)
    expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument()
  })
})

describe('detail page — Bookings', () => {
  it('lists the bookings with bills, and an em dash for an uncharged one', async () => {
    await renderLoaded('it-1', 'bookings')

    expect(await screen.findByText('PKR 1,840')).toBeInTheDocument()
    expect(screen.getByText('PKR 3,200')).toBeInTheDocument()
    // billPkr null must never read as PKR 0.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByText('PKR 0')).not.toBeInTheDocument()
  })

  it('shows the × only where the row says cancellable', async () => {
    await renderLoaded('it-1', 'bookings')

    // Parveen's booking is cancellable; the Promingler and COMPLETED rows are not.
    expect(await screen.findByLabelText(/cancel parveen rizvi/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/cancel sana khan/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/cancel osama hashmi/i)).not.toBeInTheDocument()
  })

  it('hides every × outside ACTIVE, while still listing the bookings (BR-07)', async () => {
    setMockProfileStatus('PENDING')
    await renderLoaded('it-1', 'bookings')

    expect(await screen.findByText('Parveen Rizvi')).toBeInTheDocument()
    expect(screen.queryByLabelText(/cancel parveen rizvi/i)).not.toBeInTheDocument()
  })

  it('cancels a booking through the confirm dialog', async () => {
    await renderLoaded('it-1', 'bookings')

    await userEvent.click(await screen.findByLabelText(/cancel parveen rizvi/i))
    expect(await screen.findByText('Cancel this booking?')).toBeInTheDocument()
    // The design's copy, and accurate about what the server does.
    expect(
      screen.getByText(/card hold is released, or the charge refunded if already confirmed/i),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^cancel booking$/i }))

    await waitFor(() => {
      expect(mockInterestTableBooking('bk-2')?.status).toBe('CANCELLED')
    })
    expect(await screen.findByText('Booking cancelled.')).toBeInTheDocument()
  })

  it('toasts the refusal when the server rejects a cancel the row allowed', async () => {
    /**
     * The safety net behind "never derive `cancellable`".
     *
     * Here the row claims a Promingler booking is cancellable — which is what a
     * client-side derivation from `status` alone would produce. The server still
     * refuses it, and the partner has to be told rather than left with a dialog that
     * silently did nothing.
     */
    server.use(
      http.get(PARTNER_IT_ENDPOINTS.bookings(':itId'), () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                bookingId: 'bk-1',
                bookingRef: 'BK-10043',
                minglerId: 'm-sana',
                minglerName: 'Sana Khan',
                proMingler: { isProMingler: true, kind: 'ADMIN_ASSIGNED' },
                menuOption: 'Wagyu Experience',
                date: '28-04-2026',
                billPkr: 1840,
                status: 'CONFIRMED',
                cancellable: true,
              },
            ],
          },
        }),
      ),
    )
    await renderLoaded('it-1', 'bookings')

    await userEvent.click(await screen.findByLabelText(/cancel sana khan/i))
    await userEvent.click(screen.getByRole('button', { name: /^cancel booking$/i }))

    expect(
      await screen.findByText(/pro ?mingler bookings can.t be cancelled here/i),
    ).toBeInTheDocument()
    expect(mockInterestTableBooking('bk-1')?.status).toBe('CONFIRMED')
  })

  it('opens the Booking Details popup with the fields the row omits', async () => {
    await renderLoaded('it-1', 'bookings')

    const rows = await screen.findAllByRole('button', { name: /view booking/i })
    await userEvent.click(rows[1])

    const dialog = await screen.findByRole('dialog')
    // Topic and Time are exactly why this endpoint exists.
    expect(within(dialog).getByText('Wine & Dine')).toBeInTheDocument()
    expect(within(dialog).getByText('7:00 PM')).toBeInTheDocument()
    // The restaurant row is omitted by design.
    expect(within(dialog).queryByText(/^restaurant$/i)).not.toBeInTheDocument()
  })
})

describe('detail page — the Mingler profile modal (BR-10)', () => {
  it('opens on a name click and renders the preferences generically', async () => {
    await renderLoaded('it-1', 'bookings')

    await userEvent.click(await screen.findByRole('button', { name: 'Sana Khan' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Mingler since 10 Jan 2024')).toBeInTheDocument()
    expect(within(dialog).getByText('Culinary Restrictions')).toBeInTheDocument()
    expect(within(dialog).getByText('Halal Only')).toBeInTheDocument()
    // An unanswered question is the client's job to label.
    expect(within(dialog).getAllByText('Not specified').length).toBeGreaterThan(0)
  })

  it('renders a question outside the documented seven', async () => {
    // The catalogue is admin-managed, so the modal must iterate rather than name the
    // questions — which is why MinglerEatingPreferencesTab could not be reused.
    await renderLoaded('it-1', 'bookings')

    await userEvent.click(await screen.findByRole('button', { name: 'Parveen Rizvi' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Spice Tolerance')).toBeInTheDocument()
    expect(within(dialog).getByText('Medium')).toBeInTheDocument()
  })

  it('shows no card or loyalty information', async () => {
    await renderLoaded('it-1', 'bookings')

    await userEvent.click(await screen.findByRole('button', { name: 'Sana Khan' }))

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).queryByText(/loyalty|points|card ending|payment/i),
    ).not.toBeInTheDocument()
  })
})

describe('detail page — Invited (US-04)', () => {
  it('lists invitees and offers Cancel Invite only on an INVITED row', async () => {
    await renderLoaded('it-1', 'invited')

    expect(await screen.findByLabelText(/cancel the invite for parveen rizvi/i)).toBeInTheDocument()
    // TABLE_BOOKED and CANCELLED rows offer none.
    expect(screen.queryByLabelText(/cancel the invite for sana khan/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/cancel the invite for osama hashmi/i)).not.toBeInTheDocument()
  })

  it('explains why a Table Booked row has no cancel action', async () => {
    await renderLoaded('it-1', 'invited')

    // Without this the missing × just looks broken.
    expect(await screen.findByText('Booked')).toBeInTheDocument()
  })

  it('cancels an invite, with copy that does not claim the Mingler is told', async () => {
    await renderLoaded('it-1', 'invited')

    await userEvent.click(await screen.findByLabelText(/cancel the invite for parveen rizvi/i))
    const dialog = await screen.findByRole('dialog')
    // The Mingler is deliberately NOT notified (BR-06).
    expect(within(dialog).queryByText(/notif/i)).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: /^cancel invite$/i }))

    await waitFor(() => {
      expect(mockInvitee('inv-1')?.inviteStatus).toBe('CANCELLED')
    })
    expect(await screen.findByText('Invite cancelled.')).toBeInTheDocument()
  })

  it('hides Cancel Invite outside ACTIVE', async () => {
    setMockProfileStatus('PENDING')
    await renderLoaded('it-1', 'invited')

    expect(await screen.findByText('Parveen Rizvi')).toBeInTheDocument()
    expect(screen.queryByLabelText(/cancel the invite for parveen rizvi/i)).not.toBeInTheDocument()
  })
})

describe('detail page — Menu Options', () => {
  it('lists the assigned combos read-only', async () => {
    await renderLoaded('it-1', 'combos')

    expect(await screen.findByText('Wagyu Experience')).toBeInTheDocument()
    expect(screen.getByText('PKR 480')).toBeInTheDocument()
    // Assigning combos is admin-only.
    expect(screen.queryByRole('button', { name: /add|assign|remove/i })).not.toBeInTheDocument()
  })

  it('shows an empty state for a table with none assigned', async () => {
    await renderLoaded('it-open', 'combos')

    expect(await screen.findByText('No menu options assigned')).toBeInTheDocument()
  })
})
