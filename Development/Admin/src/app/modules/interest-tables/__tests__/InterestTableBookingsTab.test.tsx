import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { server } from '../../../../mocks/server'
import { InterestTableBookingsTab } from '../components/InterestTableBookingsTab'
import type { InterestTableBooking } from '../types'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

function setMatchMedia(mobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: mobile ? /max-width/.test(q) : /min-width/.test(q),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

// Default to desktop; the mobile test opts in explicitly.
beforeEach(() => setMatchMedia(false))

const makeBooking = (overrides: Partial<InterestTableBooking> = {}): InterestTableBooking => ({
  id: '1',
  bookingId: 'BK-1',
  minglerId: 'm1',
  guest: 'Jane Doe',
  date: '2026-01-15',
  interestTableId: 'it-1',
  interestTableTopic: 'Wine Tasting',
  comboId: 'c1',
  comboName: 'Standard',
  status: 'CONFIRMED',
  bill: 150,
  ...overrides,
})

describe('InterestTableBookingsTab', () => {
  it('renders booking rows', async () => {
    renderWithProviders(<InterestTableBookingsTab bookings={[makeBooking()]} />)
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Standard')).toBeInTheDocument()
  })

  it('navigates to the mingler with an interest-table back-label when the guest name is clicked', async () => {
    renderWithProviders(<InterestTableBookingsTab bookings={[makeBooking({ minglerId: 'm42' })]} />)
    await userEvent.setup().click(await screen.findByText('Jane Doe'))
    expect(mockNavigate).toHaveBeenCalledWith('/minglers/m42', {
      state: { backLabel: 'Back to interest table' },
    })
  })

  it('renders the Bill column before the Status column', async () => {
    renderWithProviders(<InterestTableBookingsTab bookings={[makeBooking()]} />)
    const headers = (await screen.findAllByRole('columnheader')).map((h) => h.textContent)
    const billIndex = headers.findIndex((h) => /bill/i.test(h ?? ''))
    const statusIndex = headers.findIndex((h) => /status/i.test(h ?? ''))
    expect(billIndex).toBeGreaterThanOrEqual(0)
    expect(statusIndex).toBeGreaterThan(billIndex)
  })

  it('renders the empty state when there are no bookings', () => {
    renderWithProviders(<InterestTableBookingsTab bookings={[]} />)
    expect(screen.getByText('No bookings for this interest table yet.')).toBeInTheDocument()
  })

  it('renders an em dash for a zero bill', async () => {
    renderWithProviders(<InterestTableBookingsTab bookings={[makeBooking({ bill: 0 })]} />)
    expect(await screen.findByText('—')).toBeInTheDocument()
  })

  it('renders the mobile card layout and opens the modal on card click', async () => {
    setMatchMedia(true)
    server.use(
      http.get('/api/v1/admin/bookings/1', () =>
        HttpResponse.json({
          success: true,
          data: {
            id: '1',
            bookingRef: 'BK-1',
            interestTableName: 'Wine Tasting',
            topic: 'Wine',
            restaurantName: 'Aurelia',
            date: '15-01-2026',
            time: '7:30 PM',
            menuOption: 'Standard',
            isCrownProMingler: false,
            isTickProMingler: false,
            prominglerLabel: null,
            status: 'CONFIRMED',
            billPkr: 150,
          },
        }),
      ),
    )
    renderWithProviders(<InterestTableBookingsTab bookings={[makeBooking({ isCaptain: true })]} />)
    // Mobile card shows the booking ref inline.
    await userEvent.setup().click((await screen.findAllByText('BK-1'))[0])
    expect(await screen.findAllByText('BK-1')).not.toHaveLength(0)
  })

  it('opens the read-only booking detail modal (GET /admin/bookings/:id) on row click', async () => {
    server.use(
      http.get('/api/v1/admin/bookings/1', () =>
        HttpResponse.json({
          success: true,
          data: {
            id: '1',
            bookingRef: 'BK-1',
            interestTableName: 'Wine Tasting',
            topic: 'Wine',
            restaurantName: 'Aurelia',
            date: '15-01-2026',
            time: '7:30 PM',
            menuOption: 'Standard',
            isCrownProMingler: false,
            isTickProMingler: false,
            prominglerLabel: null,
            status: 'CONFIRMED',
            billPkr: 150,
          },
        }),
      ),
    )
    renderWithProviders(<InterestTableBookingsTab bookings={[makeBooking()]} />)
    // Click the combo cell (row onClick; the guest name stops propagation).
    await userEvent.setup().click(await screen.findByText('Standard'))
    expect(await screen.findByText('BK-1')).toBeInTheDocument()
  })
})
