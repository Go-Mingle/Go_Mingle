import { describe, it, expect } from 'vitest'
import {
  MIN_GUESTS_FIXED,
  countBookedSeats,
  resolveDurationHours,
  resolveDurationMinutes,
  resolveMaxGuests,
  resolveMinGuests,
} from '../tableFields'
import type { InterestTable } from '../types'

function makeTable(over: Partial<InterestTable> = {}): InterestTable {
  return {
    id: 'it1',
    name: 'Founders Dinner',
    topic: null,
    assignedTable: null,
    restaurant: { id: 'r1', name: 'Aurelia' },
    startDate: '2026-08-20',
    startTime: '19:00',
    sponsorName: null,
    sponsorLogoUrl: null,
    eventImageUrl: null,
    timeLeft: '2d',
    status: 'PENDING',
    created: '2026-07-01T00:00:00Z',
    ...over,
  }
}

// [MET-1400] The Overview tab read the V7 field names the real V8 API never
// sends, so Min/Max Minglers, Duration and Seats Booked showed stale or empty
// values. These resolvers bridge both payload shapes.
describe('tableFields — V8 payload (the real API)', () => {
  it('reads minGuests / maxGuests / durationMinutes', () => {
    const table = makeTable({ minGuests: 4, maxGuests: 8, durationMinutes: 90 })
    expect(resolveMinGuests(table)).toBe(4)
    expect(resolveMaxGuests(table)).toBe(8)
    expect(resolveDurationHours(table)).toBe(1.5)
    expect(resolveDurationMinutes(table)).toBe(90)
  })

  it('falls back to the platform-fixed minimum when minGuests is absent', () => {
    expect(resolveMinGuests(makeTable({ maxGuests: 6 }))).toBe(MIN_GUESTS_FIXED)
    expect(MIN_GUESTS_FIXED).toBe(4)
  })

  it('returns undefined for max guests and duration when the payload carries neither shape', () => {
    const table = makeTable()
    expect(resolveMaxGuests(table)).toBeUndefined()
    expect(resolveDurationHours(table)).toBeUndefined()
    // The edit modal still needs a concrete value — defaults to the 2h option.
    expect(resolveDurationMinutes(table)).toBe(120)
  })
})

describe('tableFields — legacy V7 payload (mocks / older fixtures)', () => {
  it('falls back to minMinglers / maxMinglers / durationHours', () => {
    const table = makeTable({ minMinglers: 3, maxMinglers: 6, durationHours: 2 })
    expect(resolveMinGuests(table)).toBe(3)
    expect(resolveMaxGuests(table)).toBe(6)
    expect(resolveDurationHours(table)).toBe(2)
    expect(resolveDurationMinutes(table)).toBe(120)
  })

  it('prefers the V8 field when a payload carries both shapes', () => {
    const table = makeTable({
      minGuests: 4,
      minMinglers: 3,
      maxGuests: 8,
      maxMinglers: 6,
      durationMinutes: 180,
      durationHours: 2,
    })
    expect(resolveMinGuests(table)).toBe(4)
    expect(resolveMaxGuests(table)).toBe(8)
    expect(resolveDurationHours(table)).toBe(3)
  })
})

describe('countBookedSeats', () => {
  const booking = (status: string) => ({ status })

  it('counts one seat per live booking so the tile tracks every new booking', () => {
    expect(countBookedSeats([booking('PENDING'), booking('CONFIRMED')])).toBe(2)
    // PENDING, CONFIRMED and COMPLETED all hold their seat.
    expect(countBookedSeats([booking('PENDING'), booking('CONFIRMED'), booking('COMPLETED')])).toBe(
      3,
    )
  })

  it('does not count cancelled bookings — those release the seat', () => {
    expect(countBookedSeats([booking('CONFIRMED'), booking('CANCELLED')])).toBe(1)
  })

  it('matches the cancelled status case-insensitively', () => {
    expect(countBookedSeats([booking('cancelled'), booking('confirmed')])).toBe(1)
  })

  it('counts every seat of a booking, not one per booking', () => {
    // One Mingler booking all four seats fills the table.
    expect(countBookedSeats([{ status: 'CONFIRMED', seats: 4 }])).toBe(4)
    expect(countBookedSeats([{ status: 'CONFIRMED', seats: 3 }, { status: 'CANCELLED', seats: 2 }, { status: 'CONFIRMED' }])).toBe(4)
  })

  it('returns 0 for a table with no bookings', () => {
    expect(countBookedSeats([])).toBe(0)
  })

  it('uses the fallback counter only while the bookings list has not loaded', () => {
    expect(countBookedSeats(undefined, 5)).toBe(5)
    expect(countBookedSeats(undefined)).toBe(0)
    // An empty loaded list means zero seats — never the stale fallback.
    expect(countBookedSeats([], 5)).toBe(0)
  })
})
