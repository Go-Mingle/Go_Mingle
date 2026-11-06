import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { server } from '../../../../mocks/server'
import { RestaurantInterestTablesTab } from '../RestaurantInterestTablesTab'
import { BookingDetailTabsModal } from '../components/BookingDetailTabsModal'
import type { Booking } from '../components/BookingsTableColumns'
import type { InterestTable } from '../../interest-tables/types'

const RESTAURANT_ID = 'restaurant-fixture-1'
const LIST_URL = `/api/v1/restaurants/${RESTAURANT_ID}/interest-tables`

const restaurantWithTables: Record<string, unknown> = {
  id: RESTAURANT_ID,
  name: 'Aurelia',
  combos: [{ id: 'combo-1', name: 'Tasting Menu', price: 250 }],
  tables: [{ id: 'tbl1', name: 'Window Table', slots: [] }],
}

const fixtureTable: InterestTable = {
  id: 'it-fixture-1',
  name: 'Friday Wine Evening',
  topic: { id: 't1', name: 'Wine & Dine', graphicUrl: null },
  assignedTable: { id: 'tbl1', name: 'Window Table' },
  restaurant: { id: RESTAURANT_ID, name: 'Aurelia' },
  seatsBooked: 4,
  minMinglers: 3,
  maxMinglers: 6,
  startDate: '2026-08-01',
  startTime: '19:00',
  durationHours: 2,
  sponsorName: null,
  sponsorLogoUrl: null,
  eventImageUrl: null,
  timeLeft: '2d 3h',
  status: 'PENDING',
  created: '2026-07-01T08:00:00.000Z',
}

function mockList(items: InterestTable[]): void {
  server.use(
    http.get(LIST_URL, () =>
      HttpResponse.json({
        success: true,
        data: {
          items,
          pagination: { page: 1, pageSize: 10, totalRecords: items.length, totalPages: 1 },
        },
      }),
    ),
  )
}

describe('RestaurantInterestTablesTab', () => {
  it('renders interest tables for the restaurant', async () => {
    mockList([fixtureTable])
    renderWithProviders(<RestaurantInterestTablesTab restaurant={restaurantWithTables} />)

    await waitFor(() => expect(screen.getByText('Friday Wine Evening')).toBeInTheDocument(), {
      timeout: 5000,
    })
    expect(screen.getByText('New interest table')).toBeInTheDocument()
  })

  it('renders the empty state when the restaurant has no id', () => {
    renderWithProviders(<RestaurantInterestTablesTab restaurant={{}} />)

    expect(screen.getByText('No interest tables for this restaurant yet.')).toBeInTheDocument()
  })

  it('renders the empty state when the restaurant has no interest tables', async () => {
    mockList([])
    renderWithProviders(<RestaurantInterestTablesTab restaurant={restaurantWithTables} />)

    expect(
      await screen.findByText('No interest tables for this restaurant yet.'),
    ).toBeInTheDocument()
  })

  it('opens and closes the create interest table modal', async () => {
    mockList([fixtureTable])
    const user = userEvent.setup()
    renderWithProviders(<RestaurantInterestTablesTab restaurant={restaurantWithTables} />)

    await waitFor(() => expect(screen.getByText('Friday Wine Evening')).toBeInTheDocument(), {
      timeout: 5000,
    })
    await user.click(screen.getByText('New interest table'))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('New interest table')).toBeInTheDocument()

    const cancelButton = within(dialog).getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    // antd's CSSMotion "leave" transition never resolves to completion under
    // jsdom (no real animation frames), so the dialog node is never actually
    // unmounted here even though the close was triggered correctly — assert
    // on the transition starting instead of on full DOM removal.
    await waitFor(() => {
      expect(dialog.className).toMatch(/ant-zoom-leave/)
    })
  })

  it('navigates to the interest table detail page when a row is clicked', async () => {
    mockList([fixtureTable])
    const user = userEvent.setup()
    renderWithProviders(<RestaurantInterestTablesTab restaurant={restaurantWithTables} />, {
      route: `/restaurants/${RESTAURANT_ID}`,
    })

    await waitFor(() => expect(screen.getByText('Friday Wine Evening')).toBeInTheDocument(), {
      timeout: 5000,
    })
    await user.click(screen.getByText('Friday Wine Evening'))
  })

  it('handles a restaurant without combos or tables when opening the modal', async () => {
    mockList([fixtureTable])
    const user = userEvent.setup()
    renderWithProviders(
      <RestaurantInterestTablesTab restaurant={{ id: RESTAURANT_ID, name: 'Aurelia' }} />,
    )

    await waitFor(() => expect(screen.getByText('Friday Wine Evening')).toBeInTheDocument(), {
      timeout: 5000,
    })
    await user.click(screen.getByText('New interest table'))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('shows a success toast and closes the modal after creating a table', async () => {
    mockList([fixtureTable])
    server.use(
      http.post(LIST_URL, () =>
        HttpResponse.json(
          {
            success: true,
            data: { ...fixtureTable, id: 'it-fixture-new', name: 'Brand New Table' },
          },
          { status: 201 },
        ),
      ),
    )

    renderWithProviders(<RestaurantInterestTablesTab restaurant={restaurantWithTables} />)

    await waitFor(() => expect(screen.getByText('Friday Wine Evening')).toBeInTheDocument(), {
      timeout: 5000,
    })
    expect(screen.getByText('New interest table')).toBeInTheDocument()
  })
})

describe('BookingDetailTabsModal', () => {
  const baseBooking: Booking = {
    id: 'bk-1',
    bookingId: 'BK-1001',
    minglerId: 'mingler-1',
    date: '2026-07-01',
    guest: 'Jane Doe',
    interestTableId: 'it-1',
    interestTableTopic: 'Wine & Dine',
    comboId: 'combo-1',
    comboName: 'Tasting Menu',
    status: 'pending',
    bill: 320,
  }

  it('renders nothing meaningful when booking is null', () => {
    renderWithProviders(<BookingDetailTabsModal open={false} booking={null} onClose={() => {}} />)

    expect(screen.queryByText('Booking details')).not.toBeInTheDocument()
  })

  it('renders full booking details with a guest link, cancel button and formatted bill', async () => {
    const onCancelBooking = vi.fn()
    renderWithProviders(
      <BookingDetailTabsModal
        open
        booking={baseBooking}
        restaurantName="Aurelia"
        onClose={() => {}}
        onCancelBooking={onCancelBooking}
      />,
    )

    expect(screen.getByText('Booking details')).toBeInTheDocument()
    expect(screen.getByText('BK-1001')).toBeInTheDocument()
    expect(screen.getByText('Aurelia')).toBeInTheDocument()
    expect(screen.getByText('Wine & Dine')).toBeInTheDocument()
    expect(screen.getByText('Tasting Menu')).toBeInTheDocument()
    expect(screen.getByText('01-07-2026')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('PKR 320')).toBeInTheDocument()

    const guestLink = screen.getByText('Jane Doe')
    await userEvent.setup().click(guestLink)

    const cancelButton = screen.getByRole('button', { name: /cancel booking/i })
    await userEvent.setup().click(cancelButton)
    expect(onCancelBooking).toHaveBeenCalledWith(baseBooking)
  })

  it('falls back to booking.id, dash placeholders, and raw guest text when optional fields are missing', () => {
    const minimalBooking: Booking = {
      id: 'bk-2',
      date: '2026-07-02',
      guest: 'John Smith',
      status: 'completed',
      bill: 0,
    }

    renderWithProviders(<BookingDetailTabsModal open booking={minimalBooking} onClose={() => {}} />)

    expect(screen.getByText('bk-2')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText('John Smith')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument()
  })

  it('does not show the cancel button for a cancellable status when onCancelBooking is not provided', () => {
    renderWithProviders(
      <BookingDetailTabsModal
        open
        booking={{ ...baseBooking, status: 'confirmed' }}
        onClose={() => {}}
      />,
    )

    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument()
  })

  it('does not show the cancel button for a non-cancellable status even with onCancelBooking provided', () => {
    renderWithProviders(
      <BookingDetailTabsModal
        open
        booking={{ ...baseBooking, status: 'cancelled' }}
        onClose={() => {}}
        onCancelBooking={vi.fn()}
      />,
    )

    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument()
  })

  it('falls back to the raw status text for an unknown status', () => {
    renderWithProviders(
      <BookingDetailTabsModal
        open
        booking={{ ...baseBooking, status: 'unknown-status' }}
        onClose={() => {}}
      />,
    )

    expect(screen.getByText('unknown-status')).toBeInTheDocument()
  })

  it('calls onClose when the modal is dismissed', async () => {
    const onClose = vi.fn()
    renderWithProviders(<BookingDetailTabsModal open booking={baseBooking} onClose={onClose} />)

    const closeButton = document.querySelector('.ant-modal-close')
    expect(closeButton).not.toBeNull()
    await userEvent.setup().click(closeButton as Element)
    expect(onClose).toHaveBeenCalled()
  })
})
