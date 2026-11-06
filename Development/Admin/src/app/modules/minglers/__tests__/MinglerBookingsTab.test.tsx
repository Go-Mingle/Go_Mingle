import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, fireEvent, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { MinglerBookingsTab } from '../components/MinglerBookingsTab'
import type { AdminBooking } from '../types'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const MINGLER_ID = 'm1'

const makeBooking = (overrides: Partial<AdminBooking> = {}): AdminBooking => ({
  id: 'b1',
  bookingRef: 'BK-1',
  minglerId: MINGLER_ID,
  minglerName: 'Sana Khan',
  isCaptain: false,
  interestTableId: 'it-1',
  interestTableName: 'Wine Tasting',
  topic: 'Wine & Dine',
  restaurantId: 'rest1',
  restaurantName: 'Aurelia',
  menuOption: 'Standard',
  date: '15-01-2026',
  time: '7:30 PM',
  status: 'CONFIRMED',
  billPkr: 200,
  ...overrides,
})

function mockBookings(items: AdminBooking[], overrides: Partial<{ totalRecords: number }> = {}) {
  server.use(
    http.get('/api/v1/admin/bookings', () =>
      HttpResponse.json({
        success: true,
        data: {
          items,
          pagination: {
            page: 1,
            pageSize: 10,
            totalRecords: overrides.totalRecords ?? items.length,
            totalPages: 1,
          },
        },
      }),
    ),
  )
}

beforeEach(() => {
  mockNavigate.mockClear()
})

describe('MinglerBookingsTab', () => {
  it('renders booking rows from the real { items, pagination } admin-bookings contract', async () => {
    mockBookings([makeBooking()])
    renderWithProviders(<MinglerBookingsTab minglerId={MINGLER_ID} isActive />)
    expect(await screen.findByText('BK-1')).toBeInTheDocument()
    expect(screen.getByText('Wine Tasting')).toBeInTheDocument()
  })

  it('navigates to the restaurant using restaurantId when the restaurant name is clicked', async () => {
    mockBookings([makeBooking({ restaurantId: 'rest7', restaurantName: 'Aurelia' })])
    renderWithProviders(<MinglerBookingsTab minglerId={MINGLER_ID} isActive />)
    await userEvent.setup().click(await screen.findByText('Aurelia'))
    expect(mockNavigate).toHaveBeenCalledWith('/restaurants/rest7', {
      state: { backLabel: 'Back to bookings' },
    })
  })

  it('navigates to the interest table using interestTableId when the interest table name is clicked', async () => {
    mockBookings([makeBooking({ interestTableId: 'it-42' })])
    renderWithProviders(<MinglerBookingsTab minglerId={MINGLER_ID} isActive />)
    await userEvent.setup().click(await screen.findByText('Wine Tasting'))
    expect(mockNavigate).toHaveBeenCalledWith('/interest-tables/it-42', {
      state: { backLabel: 'Back to bookings' },
    })
  })

  it('shows the Pro Mingler badge for captain bookings', async () => {
    mockBookings([makeBooking({ isCaptain: true })])
    renderWithProviders(<MinglerBookingsTab minglerId={MINGLER_ID} isActive />)
    expect(await screen.findByText('Pro Mingler')).toBeInTheDocument()
  })

  it('renders an actions column after status with a cancel action for cancellable bookings', async () => {
    mockBookings([makeBooking()]) // CONFIRMED, not captain → cancellable
    renderWithProviders(<MinglerBookingsTab minglerId={MINGLER_ID} isActive />)
    await screen.findByText('BK-1')
    // bookingRef, restaurant, interestTable, combo, date, bill, status, actions
    expect(screen.getAllByRole('columnheader')).toHaveLength(8)
    expect(screen.getByRole('button', { name: /cancel booking/i })).toBeInTheDocument()
  })

  it('shows an em-dash and no cancel action for terminal (non-cancellable) bookings', async () => {
    mockBookings([makeBooking({ status: 'COMPLETED' })])
    renderWithProviders(<MinglerBookingsTab minglerId={MINGLER_ID} isActive />)
    await screen.findByText('BK-1')
    expect(screen.getAllByRole('columnheader')).toHaveLength(8)
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument()
  })

  it('excludes captain (Pro Mingler) bookings from cancellation', async () => {
    mockBookings([makeBooking({ isCaptain: true })])
    renderWithProviders(<MinglerBookingsTab minglerId={MINGLER_ID} isActive />)
    await screen.findByText('BK-1')
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument()
  })

  it('opens the detail modal on row click and offers Cancel booking for a cancellable row', async () => {
    mockBookings([makeBooking()])
    renderWithProviders(<MinglerBookingsTab minglerId={MINGLER_ID} isActive />)
    await screen.findByText('BK-1')
    const row = document.querySelector('.ant-table-tbody tr.ant-table-row') as HTMLElement
    fireEvent.click(row)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Booking details')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /cancel booking/i })).toBeInTheDocument()
  })

  it('cancels a booking via POST /admin/bookings/:id/cancel and shows a success toast', async () => {
    let cancelledId = ''
    mockBookings([makeBooking()])
    server.use(
      http.post('/api/v1/admin/bookings/:id/cancel', ({ params }) => {
        cancelledId = params.id as string
        return HttpResponse.json({ success: true, data: { id: params.id, status: 'CANCELLED' } })
      }),
    )
    renderWithProviders(<MinglerBookingsTab minglerId={MINGLER_ID} isActive />)
    await screen.findByText('BK-1')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /cancel booking/i }))
    await user.click(await screen.findByRole('button', { name: /confirm cancellation/i }))

    await waitFor(() => expect(cancelledId).toBe('b1'))
    expect(await screen.findByText('Booking BK-1 cancelled.')).toBeInTheDocument()
  })

  it('cancels a booking initiated from the detail modal', async () => {
    let cancelledId = ''
    mockBookings([makeBooking()])
    server.use(
      http.post('/api/v1/admin/bookings/:id/cancel', ({ params }) => {
        cancelledId = params.id as string
        return HttpResponse.json({ success: true, data: { id: params.id, status: 'CANCELLED' } })
      }),
    )
    renderWithProviders(<MinglerBookingsTab minglerId={MINGLER_ID} isActive />)
    await screen.findByText('BK-1')

    const user = userEvent.setup()
    fireEvent.click(document.querySelector('.ant-table-tbody tr.ant-table-row') as HTMLElement)
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /cancel booking/i }))
    await user.click(await screen.findByRole('button', { name: /confirm cancellation/i }))

    await waitFor(() => expect(cancelledId).toBe('b1'))
    expect(await screen.findByText('Booking BK-1 cancelled.')).toBeInTheDocument()
  })

  it('shows the API error message in a toast when the cancel request fails', async () => {
    mockBookings([makeBooking()])
    server.use(
      http.post('/api/v1/admin/bookings/:id/cancel', () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_BOOKING_NOT_CANCELLABLE',
              message: 'This booking cannot be cancelled.',
            },
          },
          { status: 409 },
        ),
      ),
    )
    renderWithProviders(<MinglerBookingsTab minglerId={MINGLER_ID} isActive />)
    await screen.findByText('BK-1')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /cancel booking/i }))
    await user.click(await screen.findByRole('button', { name: /confirm cancellation/i }))

    expect(await screen.findByText('This booking cannot be cancelled.')).toBeInTheDocument()
  })

  it('requests a comma-joined status filter when the status column filter is applied', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/admin/bookings', ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json({
          success: true,
          data: {
            items: [makeBooking()],
            pagination: { page: 1, pageSize: 10, totalRecords: 1, totalPages: 1 },
          },
        })
      }),
    )
    renderWithProviders(<MinglerBookingsTab minglerId={MINGLER_ID} isActive />)
    await screen.findByText('BK-1')
    const user = userEvent.setup()
    const filterIcon = document.querySelector('.ant-table-filter-trigger') as HTMLElement
    await user.click(filterIcon)
    const dropdown = await waitFor(() => {
      const el = document.querySelector('.ant-table-filter-dropdown')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    await user.click(within(dropdown).getByText('Confirmed'))
    await user.click(within(dropdown).getByRole('button', { name: /^ok$/i }))
    await waitFor(() => expect(capturedUrl?.searchParams.get('status')).toBe('CONFIRMED'))
  })

  it('updates sortBy/sortOrder when a sortable column header is clicked', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/admin/bookings', ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json({
          success: true,
          data: {
            items: [makeBooking()],
            pagination: { page: 1, pageSize: 10, totalRecords: 1, totalPages: 1 },
          },
        })
      }),
    )
    renderWithProviders(<MinglerBookingsTab minglerId={MINGLER_ID} isActive />)
    await screen.findByText('BK-1')
    const user = userEvent.setup()
    const headers = screen.getAllByRole('columnheader')
    // Uses the Restaurant column (not pre-sorted by default) so the click
    // exercises a plain "activate sort" transition rather than the Date
    // column's default-descend "cancel" transition, which is covered below.
    const restaurantHeader = headers.find((h) => /restaurant/i.test(h.textContent ?? ''))
    await user.click(restaurantHeader as HTMLElement)
    await waitFor(() => expect(capturedUrl?.searchParams.get('sortBy')).toBe('restaurant'))
  })

  it('cycles the Date column sort through cancel, ascending and descending without getting stuck', async () => {
    const capturedUrls: URL[] = []
    server.use(
      http.get('/api/v1/admin/bookings', ({ request }) => {
        capturedUrls.push(new URL(request.url))
        return HttpResponse.json({
          success: true,
          data: {
            items: [makeBooking()],
            pagination: { page: 1, pageSize: 10, totalRecords: 1, totalPages: 1 },
          },
        })
      }),
    )
    renderWithProviders(<MinglerBookingsTab minglerId={MINGLER_ID} isActive />)
    await screen.findByText('BK-1')
    const user = userEvent.setup()
    const headers = screen.getAllByRole('columnheader')
    const dateHeader = headers.find((h) => /date/i.test(h.textContent ?? '')) as HTMLElement

    // Default state is already sortBy=date/sortOrder=desc, so the very first
    // click is AntD's "descend -> cancel" transition — it must clear
    // sortBy/sortOrder entirely rather than leaving the column stuck on desc.
    await user.click(dateHeader)
    await waitFor(() => {
      const url = capturedUrls[capturedUrls.length - 1]
      expect(url?.searchParams.has('sortBy')).toBe(false)
      expect(url?.searchParams.has('sortOrder')).toBe(false)
    })

    // 2nd click restarts the cycle at ascending.
    await user.click(dateHeader)
    await waitFor(() =>
      expect(capturedUrls[capturedUrls.length - 1]?.searchParams.get('sortOrder')).toBe('asc'),
    )
    expect(capturedUrls[capturedUrls.length - 1]?.searchParams.get('sortBy')).toBe('date')

    // 3rd click moves to descending.
    await user.click(dateHeader)
    await waitFor(() =>
      expect(capturedUrls[capturedUrls.length - 1]?.searchParams.get('sortOrder')).toBe('desc'),
    )
    expect(capturedUrls[capturedUrls.length - 1]?.searchParams.get('sortBy')).toBe('date')
  })

  it('does not fetch when the tab is inactive', async () => {
    let called = false
    server.use(
      http.get('/api/v1/admin/bookings', () => {
        called = true
        return HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 1, pageSize: 10, totalRecords: 0, totalPages: 1 },
          },
        })
      }),
    )
    renderWithProviders(<MinglerBookingsTab minglerId={MINGLER_ID} isActive={false} />)
    await new Promise((r) => setTimeout(r, 50))
    expect(called).toBe(false)
  })
})
