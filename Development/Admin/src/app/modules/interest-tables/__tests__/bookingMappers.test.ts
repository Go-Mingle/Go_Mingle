import { describe, it, expect } from 'vitest'
import { toIsoDate, bookingRowToInterestTableBooking } from '../components/bookingMappers'
import type { BookingRow } from '../../restaurants/restaurantApi.types'

const row = (over: Partial<BookingRow> = {}): BookingRow => ({
  id: 'b1',
  bookingRef: 'BK-1',
  minglerId: 'm1',
  minglerName: 'Sana Khan',
  isCrownProMingler: false,
  isTickProMingler: false,
  prominglerLabel: null,
  interestTableId: 'it1',
  interestTableName: 'Brunch',
  topic: 'Food',
  restaurantId: 'r1',
  restaurantName: 'Aurelia',
  menuOption: 'Set Menu',
  date: '04-05-2026',
  time: '7:30 PM',
  status: 'CONFIRMED',
  billPkr: 240,
  ...over,
})

describe('toIsoDate', () => {
  it('converts DD-MM-YYYY to YYYY-MM-DD', () => {
    expect(toIsoDate('04-05-2026')).toBe('2026-05-04')
  })
  it('leaves an unrecognised format untouched', () => {
    expect(toIsoDate('2026-05-04')).toBe('2026-05-04')
    expect(toIsoDate('whatever')).toBe('whatever')
  })
})

describe('bookingRowToInterestTableBooking', () => {
  it('maps a full row to the view shape', () => {
    const v = bookingRowToInterestTableBooking(row())
    expect(v).toMatchObject({
      id: 'b1',
      bookingId: 'BK-1',
      minglerId: 'm1',
      guest: 'Sana Khan',
      date: '2026-05-04',
      interestTableTopic: 'Food',
      comboName: 'Set Menu',
      status: 'CONFIRMED',
      bill: 240,
      isCaptain: false,
    })
  })

  it('carries the seats a booking holds, one when the API does not say', () => {
    expect(bookingRowToInterestTableBooking(row({ seats: 4 })).seats).toBe(4)
    expect(bookingRowToInterestTableBooking(row()).seats).toBe(1)
    expect(bookingRowToInterestTableBooking(row({ seats: 0 })).seats).toBe(1)
  })

  it('falls back topic→interestTableName, null menuOption→"", null bill→0', () => {
    const v = bookingRowToInterestTableBooking(
      row({ topic: null, menuOption: null, billPkr: null }),
    )
    expect(v.interestTableTopic).toBe('Brunch')
    expect(v.comboName).toBe('')
    expect(v.bill).toBe(0)
  })

  it('marks isCaptain when either Pro Mingler flag is set', () => {
    expect(bookingRowToInterestTableBooking(row({ isTickProMingler: true })).isCaptain).toBe(true)
    expect(bookingRowToInterestTableBooking(row({ isCrownProMingler: true })).isCaptain).toBe(true)
  })
})
