import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../../mocks/server'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../mocks/data/partnerRestaurantProfile'
import {
  mockInvitee,
  resetMockInterestTables,
} from '../../../../../mocks/data/partnerInterestTables'
import { PARTNER_IT_ENDPOINTS } from '../constants'
import { BookingDetailsModal } from '../components/BookingDetailsModal'
import { InvitedTab } from '../components/InvitedTab'
import { MenuOptionsTab } from '../components/MenuOptionsTab'
import { MinglerProfileModal } from '../components/MinglerProfileModal'
import { PartnerInterestTableDetailPage } from '../components/PartnerInterestTableDetailPage'
import type { InterestTableDetailController } from '../hooks/useInterestTableDetail'

const originalMatchMedia = window.matchMedia

/** Below 768px the design switches every table to a card list. */
function setMobile() {
  window.matchMedia = ((query: string) => ({
    matches: /max-width/.test(query),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

function renderDetail(itId = 'it-1', tab?: string) {
  const route = `/interest-tables/${itId}${tab ? `?tab=${tab}` : ''}`
  return renderWithProviders(
    <Routes>
      <Route path="/interest-tables/:id" element={<PartnerInterestTableDetailPage />} />
    </Routes>,
    { route },
  )
}

beforeEach(() => {
  resetMockProfile()
  setMockProfileStatus('ACTIVE')
  resetMockInterestTables()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('MenuOptionsTab — states', () => {
  it('spins while loading', () => {
    const { container } = renderWithProviders(
      <MenuOptionsTab items={[]} isPending isError={false} />,
    )

    expect(container.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it('shows an error', () => {
    renderWithProviders(<MenuOptionsTab items={[]} isPending={false} isError />)

    expect(screen.getByText('Failed to load data. Please try again.')).toBeInTheDocument()
  })

  it('renders a combo with its courses and choice count', () => {
    renderWithProviders(
      <MenuOptionsTab
        isPending={false}
        isError={false}
        items={[
          {
            name: 'Wagyu Experience',
            pricePkr: 480,
            courses: [{ course: 'Mains', choose: 2, options: ['Wagyu', 'Sea Bass'] }],
          },
        ]}
      />,
    )

    expect(screen.getByText('Wagyu Experience')).toBeInTheDocument()
    expect(screen.getByText('PKR 480')).toBeInTheDocument()
    expect(screen.getByText(/Mains · Choice of 2/)).toBeInTheDocument()
    expect(screen.getByText('Sea Bass')).toBeInTheDocument()
  })
})

/**
 * The modal owns its own query (it takes `{ bookingId, onClose }`, so J6G's Reviews tab
 * can open it from a review row), which is why these drive it through MSW rather than a
 * hand-built controller — the same way `MinglerProfileModal` is tested below.
 */
describe('BookingDetailsModal — states', () => {
  const BOOKING_ROUTE = `*${PARTNER_IT_ENDPOINTS.bookingById(':bookingId')}`

  it('spins while the detail loads', () => {
    renderWithProviders(<BookingDetailsModal bookingId="bk-1" onClose={vi.fn()} />)

    // AntD renders a Modal into a portal on document.body, so the render container
    // never contains it.
    expect(document.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it('shows an error when the detail read fails', async () => {
    server.use(http.get(BOOKING_ROUTE, () => HttpResponse.json({}, { status: 500 })))
    renderWithProviders(<BookingDetailsModal bookingId="bk-1" onClose={vi.fn()} />)

    expect(await screen.findByText('Failed to load data. Please try again.')).toBeInTheDocument()
  })

  it('renders an em dash for an uncharged bill', async () => {
    server.use(
      http.get(BOOKING_ROUTE, () =>
        HttpResponse.json({
          success: true,
          data: {
            bookingId: 'bk-3',
            bookingRef: 'BK-10045',
            minglerName: 'Laiba Naseer',
            interestTableName: 'Friday Wine Evening',
            topic: 'Wine & Dine',
            menuOption: 'Wagyu Experience',
            date: '28-04-2026',
            time: '7:00 PM',
            status: 'PENDING',
            billPkr: null,
          },
        }),
      ),
    )
    renderWithProviders(<BookingDetailsModal bookingId="bk-3" onClose={vi.fn()} />)

    const ref = await screen.findByText('BK-10045')
    const dialog = ref.closest('[role="dialog"]') as HTMLElement
    expect(within(dialog).getByText('—')).toBeInTheDocument()
  })

  /** Closed means no request either — the query is disabled while the id is null. */
  it('renders nothing and fetches nothing while closed', () => {
    const requested: string[] = []
    server.events.on('request:start', ({ request }) => requested.push(request.url))
    renderWithProviders(<BookingDetailsModal bookingId={null} onClose={vi.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(requested.filter((url) => url.includes('/bookings/'))).toEqual([])
    server.events.removeAllListeners()
  })
})

describe('MinglerProfileModal', () => {
  it('renders "Profile unavailable" for an unreachable Mingler', async () => {
    // Expected, not a bug — a partner may only view Minglers on their own tables.
    renderWithProviders(<MinglerProfileModal minglerId="m-unknown" onClose={vi.fn()} />)

    expect(await screen.findByText('Profile unavailable')).toBeInTheDocument()
    expect(
      screen.getByText(
        /only view minglers with a booking or invite on one of your interest tables/i,
      ),
    ).toBeInTheDocument()
  })

  it('explains an empty preference list rather than showing a blank grid', async () => {
    renderWithProviders(<MinglerProfileModal minglerId="m-osama" onClose={vi.fn()} />)

    expect(await screen.findByText(/hasn.t shared any eating preferences yet/i)).toBeInTheDocument()
  })

  it('shows the self-claimed crown and the account status pill', async () => {
    renderWithProviders(<MinglerProfileModal minglerId="m-osama" onClose={vi.fn()} />)

    expect(await screen.findByText('Osama Hashmi')).toBeInTheDocument()
    expect(screen.getByText('Pro Mingler')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('maps a suspended account to its own pill', async () => {
    renderWithProviders(<MinglerProfileModal minglerId="m-quiet" onClose={vi.fn()} />)

    expect(await screen.findByText('Laiba Naseer')).toBeInTheDocument()
    expect(screen.getByText('Suspended')).toBeInTheDocument()
    // Every question unanswered.
    expect(screen.getAllByText('Not specified')).toHaveLength(2)
  })

  it('spins while loading and closes on cancel', async () => {
    const onClose = vi.fn()
    renderWithProviders(<MinglerProfileModal minglerId="m-sana" onClose={onClose} />)
    // Portalled onto document.body, as above.
    expect(document.querySelector('.ant-spin')).toBeInTheDocument()

    await screen.findByText('Sana Khan')
    await userEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(onClose).toHaveBeenCalled()
  })

  it('renders nothing without an id', () => {
    renderWithProviders(<MinglerProfileModal minglerId={null} onClose={vi.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each([
    ['a missing minglerSince', undefined],
    ['a blank minglerSince', '   '],
    ['a literal "Invalid Date"', 'Invalid Date'],
  ])('falls back to a dash for %s (MET-1340)', async (_label, minglerSince) => {
    server.use(
      http.get(PARTNER_IT_ENDPOINTS.minglerById('m-dateless'), () =>
        HttpResponse.json({
          id: 'm-dateless',
          fullName: 'Dateless Diner',
          isProMingler: false,
          proMinglerKind: 'NONE',
          minglerSince,
          accountStatus: 'ACTIVE',
          eatingPreferences: [],
        }),
      ),
    )
    renderWithProviders(<MinglerProfileModal minglerId="m-dateless" onClose={vi.fn()} />)

    expect(await screen.findByText('Dateless Diner')).toBeInTheDocument()
    expect(screen.getByText('Mingler since —')).toBeInTheDocument()
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
  })
})

describe('InvitedTab — states rendered directly', () => {
  /**
   * Reached directly rather than through the page, because the page only mounts this
   * tab once `inviteOnly` is known — so a failed invitees read hides the tab instead
   * of showing its error, and these two branches are otherwise unreachable.
   */
  function stub(overrides: Partial<InterestTableDetailController>) {
    return {
      invitees: [],
      inviteesPending: false,
      inviteesError: false,
      canCancel: true,
      openMingler: vi.fn(),
      requestCancelInvite: vi.fn(),
      ...overrides,
    } as InterestTableDetailController
  }

  it('spins while loading', () => {
    const { container } = renderWithProviders(<InvitedTab c={stub({ inviteesPending: true })} />)

    expect(container.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it('shows an error when the invitee read fails', () => {
    renderWithProviders(<InvitedTab c={stub({ inviteesError: true })} />)

    expect(screen.getByText('Failed to load data. Please try again.')).toBeInTheDocument()
  })
})

describe('InvitedTab — the per-row cancel cell', () => {
  it('renders all three invite statuses with their own pills', async () => {
    renderDetail('it-1', 'invited')

    // Scoped to the table: "Invited" is also the tab's own label.
    const table = await screen.findByRole('table')
    expect(within(table).getByText('Invited')).toBeInTheDocument()
    expect(within(table).getByText('Table Booked')).toBeInTheDocument()
    expect(within(table).getByText('Cancelled')).toBeInTheDocument()
  })

  it('offers nothing at all on an already-cancelled row', async () => {
    renderDetail('it-1', 'invited')

    await screen.findByText('Osama Hashmi')
    const row = screen.getByText('Osama Hashmi').closest('tr') as HTMLElement
    // Not a cancel button, and not the "Booked" explanation either — a cancelled
    // invite has nothing left to say.
    expect(within(row).queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
    expect(within(row).queryByText('Booked')).not.toBeInTheDocument()
  })

  it('opens the Mingler profile from an invitee name (BR-10)', async () => {
    // The names are clickable in Invited as well as Bookings, not just Bookings.
    renderDetail('it-1', 'invited')

    await userEvent.click(await screen.findByRole('button', { name: 'Parveen Rizvi' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Mingler since 22 Mar 2025')).toBeInTheDocument()
  })

  it('shows the empty state when a table has no invitees', async () => {
    server.use(
      http.get(PARTNER_IT_ENDPOINTS.invitees(':itId'), () =>
        HttpResponse.json({ success: true, data: { inviteOnly: true, items: [] } }),
      ),
    )
    renderDetail('it-1', 'invited')

    expect(await screen.findByText('No invites sent yet')).toBeInTheDocument()
  })

  it('spins while the invitees load', () => {
    renderDetail('it-1', 'invited')

    expect(document.querySelector('.ant-spin')).toBeInTheDocument()
  })
})

describe('the detail page on mobile', () => {
  it('swaps the tab strip for a dropdown', async () => {
    setMobile()
    renderDetail()

    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('renders bookings as cards, with the bill and a working cancel', async () => {
    setMobile()
    renderDetail('it-1', 'bookings')

    expect(await screen.findByText('Parveen Rizvi')).toBeInTheDocument()
    expect(screen.getByText('PKR 3,200')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText(/cancel parveen rizvi/i))
    expect(await screen.findByText('Cancel this booking?')).toBeInTheDocument()
  })

  it('opens the booking popup from a card', async () => {
    setMobile()
    renderDetail('it-1', 'bookings')

    const views = await screen.findAllByRole('button', { name: 'View' })
    await userEvent.click(views[1])

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('renders invitees as cards and cancels from one', async () => {
    setMobile()
    renderDetail('it-1', 'invited')

    await userEvent.click(await screen.findByLabelText(/cancel the invite for parveen rizvi/i))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /^cancel invite$/i }))

    await waitFor(() => {
      expect(mockInvitee('inv-1')?.inviteStatus).toBe('CANCELLED')
    })
  })

  it('opens the Mingler profile from an invitee card', async () => {
    setMobile()
    renderDetail('it-1', 'invited')

    await userEvent.click(await screen.findByRole('button', { name: 'Parveen Rizvi' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('explains a Table Booked row on a mobile card too', async () => {
    setMobile()
    renderDetail('it-1', 'invited')

    expect(await screen.findByText('Booked')).toBeInTheDocument()
  })

  it('hides the mobile cancel affordances outside ACTIVE', async () => {
    setMobile()
    setMockProfileStatus('PENDING')
    renderDetail('it-1', 'invited')

    expect(await screen.findByText('Parveen Rizvi')).toBeInTheDocument()
    expect(screen.queryByLabelText(/cancel the invite for parveen rizvi/i)).not.toBeInTheDocument()
  })
})

describe('the detail page — remaining branches', () => {
  it('goes back from the header', async () => {
    renderDetail()

    await screen.findByRole('heading', { level: 1 })
    // Only asserts the control exists and is clickable; MemoryRouter has no history
    // entry behind it to observe.
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
  })

  it('surfaces a non-404 read failure as an error panel, not "not found"', async () => {
    server.use(
      http.get(PARTNER_IT_ENDPOINTS.interestTableById(':itId'), () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_INTERNAL', message: 'Interest table unavailable.' },
          },
          { status: 500 },
        ),
      ),
    )
    renderDetail()

    expect(await screen.findByText('Interest table unavailable.')).toBeInTheDocument()
    expect(screen.queryByText('Interest table not found')).not.toBeInTheDocument()
  })

  it('shows the bookings empty state', async () => {
    renderDetail('it-open', 'bookings')

    expect(await screen.findByText('No bookings yet')).toBeInTheDocument()
  })

  it('surfaces a failed bookings read', async () => {
    server.use(
      http.get(PARTNER_IT_ENDPOINTS.bookings(':itId'), () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL', message: 'Bookings unavailable.' } },
          { status: 500 },
        ),
      ),
    )
    renderDetail('it-1', 'bookings')

    expect(await screen.findByText('Bookings unavailable.')).toBeInTheDocument()
  })

  it('surfaces a failed invitees read', async () => {
    server.use(
      http.get(PARTNER_IT_ENDPOINTS.invitees(':itId'), () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    )
    renderDetail('it-1', 'invited')

    // With `inviteOnly` unknown the tab is not rendered, so the failure shows on the
    // default pane rather than inside a tab that never appears.
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Invited' })).not.toBeInTheDocument()
  })

  it('switches tabs through the desktop strip', async () => {
    renderDetail()

    await userEvent.click(await screen.findByRole('tab', { name: 'Bookings' }))

    expect(await screen.findByText('Parveen Rizvi')).toBeInTheDocument()
  })

  it('renders an initial-letter thumb for a table with no image', async () => {
    // `it-soon` has imageUrl: null.
    renderDetail('it-soon')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      "Chef's Counter Tasting",
    )
  })
})
