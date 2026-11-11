import type { BookingRow } from '../../restaurants/restaurantApi.types'
import type { InterestTableBooking, InterestTableStatus } from '../types'

/** Convert the API's DD-MM-YYYY date to a dayjs-parseable YYYY-MM-DD. */
export function toIsoDate(date: string): string {
  const parts = date.split('-')
  if (parts.length === 3 && parts[2].length === 4) {
    const [d, m, y] = parts
    return `${y}-${m}-${d}`
  }
  return date
}

/** Map a J10C bookings-list row to the interest-table Bookings sub-tab view shape. */
export function bookingRowToInterestTableBooking(row: BookingRow): InterestTableBooking {
  return {
    id: row.id,
    bookingId: row.bookingRef,
    minglerId: row.minglerId,
    guest: row.minglerName,
    date: toIsoDate(row.date),
    interestTableId: row.interestTableId,
    interestTableTopic: row.topic ?? row.interestTableName,
    comboId: '',
    comboName: row.menuOption ?? '',
    // API statuses are UPPERCASE (match InterestTableStatus / the badge colours).
    status: row.status as InterestTableStatus,
    bill: row.billPkr ?? 0,
    // One Mingler can hold several seats in a single booking.
    seats: typeof row.seats === 'number' && row.seats > 0 ? row.seats : 1,
    isCaptain: row.isTickProMingler || row.isCrownProMingler,
  }
}
