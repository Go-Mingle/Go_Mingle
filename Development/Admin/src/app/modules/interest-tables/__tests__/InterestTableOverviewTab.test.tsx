import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { InterestTableOverviewTab } from '../components/InterestTableOverviewTab'
import type { InterestTable } from '../types'

function makeTable(over: Partial<InterestTable> = {}): InterestTable {
  return {
    id: 'it1',
    name: 'Founders Dinner',
    topic: null,
    assignedTable: null,
    restaurant: { id: 'r1', name: 'Aurelia' },
    seatsBooked: 0,
    minGuests: 4,
    maxGuests: 6,
    startDate: '2026-08-20',
    startTime: '19:00',
    durationMinutes: 120,
    sponsorName: null,
    sponsorLogoUrl: null,
    eventImageUrl: null,
    timeLeft: '2d',
    status: 'PENDING',
    created: '2026-07-01T00:00:00Z',
    ...over,
  }
}

// MET-1309 — the Created field rendered "Invalid Date" because the real API
// sends 'DD-MM-YYYY HH:mm', which a plain dayjs() parse rejects.
describe('InterestTableOverviewTab — date fields', () => {
  it('renders the created date for the real API "DD-MM-YYYY HH:mm" shape', () => {
    renderWithProviders(
      <InterestTableOverviewTab table={makeTable({ created: '16-07-2026 15:44' })} />,
    )
    expect(screen.getByText('16 Jul 2026')).toBeInTheDocument()
    expect(screen.queryByText(/Invalid Date/i)).toBeNull()
  })

  it('renders the created date for an ISO timestamp', () => {
    renderWithProviders(
      <InterestTableOverviewTab table={makeTable({ created: '2026-07-01T10:00:00' })} />,
    )
    expect(screen.getByText('01 Jul 2026')).toBeInTheDocument()
  })

  it('renders a dash instead of "Invalid Date" for a missing created timestamp', () => {
    renderWithProviders(<InterestTableOverviewTab table={makeTable({ created: '' })} />)
    expect(screen.queryByText(/Invalid Date/i)).toBeNull()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('renders the start date for both the ISO and "DD-MM-YYYY" shapes', () => {
    const { unmount } = renderWithProviders(
      <InterestTableOverviewTab table={makeTable({ startDate: '2026-08-20' })} />,
    )
    expect(screen.getByText('20 Aug 2026')).toBeInTheDocument()
    unmount()

    renderWithProviders(<InterestTableOverviewTab table={makeTable({ startDate: '20-08-2026' })} />)
    expect(screen.getByText('20 Aug 2026')).toBeInTheDocument()
  })
})

// MET-1400 — Min Minglers was hardcoded to "3", and Max Minglers / Duration /
// Seats Booked read the V7 field names (maxMinglers, durationHours) that the
// real V8 API never sends, so all four tiles showed stale or empty values.
describe('InterestTableOverviewTab — seat & duration fields', () => {
  function squareCount(container: HTMLElement) {
    // The seat tile is the only place SeatSquares renders bordered spans.
    return container.querySelectorAll('span[style*="border-radius: 3px"]').length
  }

  it('renders min minglers from the payload instead of a hardcoded 3', () => {
    renderWithProviders(<InterestTableOverviewTab table={makeTable({ minGuests: 4 })} />)
    expect(screen.getByText('4 minglers')).toBeInTheDocument()
    expect(screen.queryByText('3')).toBeNull()
  })

  it('renders max minglers and duration from the real V8 fields', () => {
    renderWithProviders(
      <InterestTableOverviewTab table={makeTable({ maxGuests: 8, durationMinutes: 90 })} />,
    )
    expect(screen.getByText('8 minglers')).toBeInTheDocument()
    expect(screen.getByText('1.5 hours')).toBeInTheDocument()
  })

  it('still renders the legacy V7 fields when only those are present', () => {
    renderWithProviders(
      <InterestTableOverviewTab
        table={makeTable({
          minGuests: undefined,
          maxGuests: undefined,
          durationMinutes: undefined,
          minMinglers: 4,
          maxMinglers: 6,
          durationHours: 2,
        })}
      />,
    )
    expect(screen.getByText('6 minglers')).toBeInTheDocument()
    expect(screen.getByText('2 hours')).toBeInTheDocument()
  })

  it('draws one seat square per max guest, filled for booked seats', () => {
    const { container } = renderWithProviders(
      <InterestTableOverviewTab table={makeTable({ maxGuests: 8, seatsBooked: 3 })} />,
    )
    expect(squareCount(container)).toBe(8)
    const filled = container.querySelectorAll('span[style*="background: var(--color-coral)"]')
    expect(filled).toHaveLength(3)
  })

  it('falls back to a dash rather than rendering "undefined hours" or NaN seats', () => {
    const { container } = renderWithProviders(
      <InterestTableOverviewTab
        table={makeTable({ maxGuests: undefined, durationMinutes: undefined })}
      />,
    )
    expect(screen.queryByText(/undefined/i)).toBeNull()
    expect(screen.queryByText(/NaN/i)).toBeNull()
    expect(squareCount(container)).toBe(0)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})
