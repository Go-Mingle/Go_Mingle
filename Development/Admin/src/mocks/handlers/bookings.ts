import { http, HttpResponse } from 'msw'
import { mockMinglerBookings, mockRestaurants, mockMinglers } from '../data/index'

const BASE = '/api/v1/admin/bookings'

const restaurantByName = new Map(mockRestaurants.map((r) => [r.name, r]))

function toIsoDate(ddMmYyyy: string): string {
  // mockMinglerBookings dates are stored as YYYY-MM-DD; convert to the real
  // API's DD-MM-YYYY display format.
  const [year, month, day] = ddMmYyyy.split('-')
  return `${day}-${month}-${year}`
}

function toAdminBooking(b: (typeof mockMinglerBookings)[number], minglerId: string) {
  const mingler = mockMinglers.find((m) => m.id === minglerId)
  const restaurant = restaurantByName.get(b.restaurant)
  return {
    id: b.id,
    bookingRef: b.bookingId,
    minglerId,
    minglerName: mingler?.name ?? 'Unknown',
    // isCaptain kept for the minglers surface; CR-023 Pro Mingler flags added for
    // the interest-table bookings surface (BookingRow).
    isCaptain: !!b.isCaptain,
    isCrownProMingler: false,
    isTickProMingler: !!b.isCaptain,
    prominglerLabel: b.isCaptain ? 'Pro Mingler' : null,
    interestTableId: b.interestTableId,
    interestTableName: b.interestTableTopic,
    topic: b.interestTableTopic,
    restaurantId: restaurant?.id ?? b.restaurant,
    restaurantName: b.restaurant,
    menuOption: b.comboName,
    date: toIsoDate(b.date),
    time: '7:30 PM',
    status: b.status.toUpperCase() as 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED',
    billPkr: b.bill > 0 ? b.bill : null,
  }
}

function toSortableDate(ddMmYyyy: string): string {
  // b.date is display-formatted DD-MM-YYYY; re-order to YYYY-MM-DD so string
  // comparison sorts chronologically instead of lexicographically.
  const [day, month, year] = ddMmYyyy.split('-')
  return `${year}-${month}-${day}`
}

const SORT_GETTERS: Record<string, (b: ReturnType<typeof toAdminBooking>) => string | number> = {
  date: (b) => toSortableDate(b.date),
  status: (b) => b.status,
  mingler: (b) => b.minglerName,
  restaurant: (b) => b.restaurantName,
}

export const bookingsHandlers = [
  // GET /api/v1/admin/bookings — read-only view owned by the Bookings module,
  // consumed here scoped to a single minglerId (the only scope this admin
  // panel surface uses today).
  http.get(BASE, ({ request }) => {
    const url = new URL(request.url)
    const minglerId = url.searchParams.get('minglerId')
    const interestTableId = url.searchParams.get('interestTableId')
    // Exactly one scope filter is required (J10C US-001).
    if (!minglerId && !interestTableId) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_VALIDATION',
            message: 'A booking scope filter is required.',
            details: {},
          },
        },
        { status: 400 },
      )
    }
    const status = url.searchParams.get('status')?.split(',').filter(Boolean) ?? []
    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('pageSize') ?? 10)
    const sortBy = url.searchParams.get('sortBy') ?? 'date'
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

    // interestTableId scope: bookings for one table, minglers assigned round-robin
    // (the mock seeds carry no per-booking mingler). minglerId scope: as before.
    let items = interestTableId
      ? mockMinglerBookings
          .filter((b) => b.interestTableId === interestTableId)
          .map((b, i) => toAdminBooking(b, mockMinglers[i % mockMinglers.length]?.id ?? 'm1'))
      : mockMinglerBookings.map((b) => toAdminBooking(b, minglerId!))
    if (status.length) items = items.filter((b) => status.includes(b.status))

    const sortGetter = SORT_GETTERS[sortBy] ?? SORT_GETTERS.date
    items = [...items].sort((a, b) => {
      const [va, vb] = [sortGetter(a), sortGetter(b)]
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortOrder === 'asc' ? cmp : -cmp
    })

    const totalRecords = items.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    const start = (page - 1) * pageSize

    return HttpResponse.json({
      success: true,
      data: {
        items: items.slice(start, start + pageSize),
        pagination: { page, pageSize, totalRecords, totalPages },
      },
    })
  }),

  // GET /api/v1/admin/bookings/:id — single booking detail (View Booking popup)
  http.get(`${BASE}/:id`, ({ params }) => {
    const id = params.id as string
    const b =
      mockMinglerBookings.find((x) => x.id === id) ??
      mockMinglerBookings.find((x) => x.bookingId === id)
    if (!b) {
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_BOOKING_NOT_FOUND', message: 'Booking not found.' } },
        { status: 404 },
      )
    }
    return HttpResponse.json({
      success: true,
      data: {
        id: b.id,
        bookingRef: b.bookingId,
        interestTableName: b.interestTableTopic,
        topic: b.interestTableTopic,
        restaurantName: b.restaurant,
        date: toIsoDate(b.date),
        time: '7:30 PM',
        menuOption: b.comboName,
        isCrownProMingler: !!b.isCaptain,
        isTickProMingler: false,
        prominglerLabel: b.isCaptain ? 'Pro Mingler' : null,
        status: b.status.toUpperCase(),
        billPkr: b.bill > 0 ? b.bill : null,
      },
    })
  }),

  // POST /api/v1/admin/bookings/:id/cancel — admin-cancel a single booking.
  // Server runs the refund/hold-release cascade (J10C / CR-010); here the
  // booking itself moves to Cancelled so every list that shows it updates.
  http.post(`${BASE}/:id/cancel`, ({ params }) => {
    const id = params.id as string
    const b =
      mockMinglerBookings.find((x) => x.id === id) ??
      mockMinglerBookings.find((x) => x.bookingId === id)
    if (!b) {
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_BOOKING_NOT_FOUND', message: 'Booking not found.' } },
        { status: 404 },
      )
    }
    const status = b.status.toUpperCase()
    if (status !== 'PENDING' && status !== 'CONFIRMED') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_BOOKING_NOT_CANCELLABLE',
            message: 'This booking can no longer be cancelled.',
          },
        },
        { status: 409 },
      )
    }
    // Keep the casing the fixture uses for this booking.
    b.status = (
      b.status === b.status.toLowerCase()
        ? 'cancelled'
        : b.status === b.status.toUpperCase()
          ? 'CANCELLED'
          : 'Cancelled'
    ) as typeof b.status
    return HttpResponse.json({ success: true, data: { id: b.id, status: 'CANCELLED' } })
  }),
]
