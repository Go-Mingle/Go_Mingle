import type { InterestTable } from './types'

/**
 * [MET-1400] The detail Overview read the V7 field names (`minMinglers`,
 * `maxMinglers`, `durationHours`, `seatsBooked`) that the real V8 API never
 * sends, so those four tiles rendered stale or empty values. The V8 detail
 * payload carries `minGuests` / `maxGuests` / `durationMinutes` instead, and
 * reports occupancy through the bookings list rather than a count on the table.
 *
 * These resolvers are the single place that bridges both shapes: prefer the
 * real field, fall back to the legacy one so mock-backed and older payloads
 * keep working.
 */

/** Party size is platform-fixed at a minimum of 4 (V8) — see `form.minGuestsFixed`. */
export const MIN_GUESTS_FIXED = 4

/**
 * The one booking status that releases its seat. Booking statuses are
 * PENDING | CONFIRMED | COMPLETED | CANCELLED (see `AdminBookingStatus`); the
 * first three all hold a seat, so only CANCELLED is excluded.
 */
const SEAT_RELEASING_STATUS = 'CANCELLED'

export function resolveMinGuests(table: InterestTable): number {
  return table.minGuests ?? table.minMinglers ?? MIN_GUESTS_FIXED
}

export function resolveMaxGuests(table: InterestTable): number | undefined {
  return table.maxGuests ?? table.maxMinglers
}

export function resolveDurationHours(table: InterestTable): number | undefined {
  if (typeof table.durationMinutes === 'number') return table.durationMinutes / 60
  return table.durationHours
}

/** Duration in minutes for the edit modal, defaulting to the 2h middle option. */
export function resolveDurationMinutes(table: InterestTable): number {
  const hours = resolveDurationHours(table)
  return typeof hours === 'number' ? Math.round(hours * 60) : 120
}

/**
 * Seats booked = one seat per live booking on this table. Derived from the
 * bookings list (the page already loads it) rather than a table-level counter,
 * so the tile moves the moment a booking is made or cancelled — which is what
 * MET-1400 asks for. Falls back to the legacy counter when no list is loaded.
 */
export function countBookedSeats(
  // `status` is deliberately a plain string, not `InterestTableStatus`: it
  // originates from `BookingRow.status`, which the API types as string.
  // `seats` is how many seats the booking holds; one when the API does not say.
  bookings: { status: string; seats?: number }[] | undefined,
  fallback?: number,
): number {
  if (!bookings) return fallback ?? 0
  return bookings
    .filter((b) => b.status?.toUpperCase() !== SEAT_RELEASING_STATUS)
    .reduce((total, b) => total + (typeof b.seats === 'number' && b.seats > 0 ? b.seats : 1), 0)
}
