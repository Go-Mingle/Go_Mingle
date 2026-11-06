import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import {
  toDateRange,
  formatKarachiDateTime,
  formatNotificationDateTime,
  formatTableDateTime,
  formatLongDate,
  formatShortDate,
  dateSortValue,
  formatRelativeTime,
  isFutureDate,
  isPastDate,
  isPastTimeOnDate,
  parseFlexibleDate,
} from '../dateHelpers'

describe('toDateRange', () => {
  it('returns null for non-array values', () => {
    expect(toDateRange(null)).toBeNull()
    expect(toDateRange(undefined)).toBeNull()
    expect(toDateRange('2026-01-01')).toBeNull()
    expect(toDateRange(42)).toBeNull()
    expect(toDateRange({ start: dayjs(), end: dayjs() })).toBeNull()
  })

  it('returns null for arrays with length other than 2', () => {
    expect(toDateRange([])).toBeNull()
    expect(toDateRange([dayjs()])).toBeNull()
    expect(toDateRange([dayjs(), dayjs(), dayjs()])).toBeNull()
  })

  it('returns null when array elements are not Dayjs instances', () => {
    expect(toDateRange(['2026-01-01', '2026-12-31'])).toBeNull()
    expect(toDateRange([new Date(), new Date()])).toBeNull()
    expect(toDateRange([dayjs(), '2026-12-31'])).toBeNull()
    expect(toDateRange(['2026-01-01', dayjs()])).toBeNull()
  })

  it('returns the [Dayjs, Dayjs] tuple when both elements are Dayjs instances', () => {
    const start = dayjs('2026-01-01')
    const end = dayjs('2026-12-31')
    const result = toDateRange([start, end])
    expect(result).not.toBeNull()
    expect(result![0]).toBe(start)
    expect(result![1]).toBe(end)
  })
})

describe('formatKarachiDateTime', () => {
  it('formats an ISO UTC string as DD-MM-YYYY HH:MM in Karachi time (UTC+5)', () => {
    // 2026-06-05T10:30:00Z → 14:30 in Karachi (UTC+5)
    expect(formatKarachiDateTime('2026-06-05T10:30:00.000Z')).toBe('05-06-2026 15:30')
  })

  it('handles a midnight UTC time correctly', () => {
    // 2026-01-01T00:00:00Z → 04:00 in Karachi (UTC+5)
    expect(formatKarachiDateTime('2026-01-01T00:00:00.000Z')).toBe('01-01-2026 05:00')
  })

  it('zero-pads single-digit days and months', () => {
    // 2026-03-02T06:00:00Z → 10:00 in Karachi
    expect(formatKarachiDateTime('2026-03-02T06:00:00.000Z')).toBe('02-03-2026 11:00')
  })

  it('returns the raw string for a non-ISO display-ready value without throwing', () => {
    // Backend may return an already-formatted DD-MM-YYYY HH:MM string.
    expect(() => formatKarachiDateTime('17-06-2026 19:22')).not.toThrow()
    expect(formatKarachiDateTime('17-06-2026 19:22')).toBe('17-06-2026 19:22')
  })

  it('returns the raw string for a completely unparseable value', () => {
    expect(formatKarachiDateTime('not-a-date')).toBe('not-a-date')
  })
})

describe('parseFlexibleDate', () => {
  it('parses ISO 8601 strings', () => {
    expect(parseFlexibleDate('2026-05-08T14:14:00').isValid()).toBe(true)
  })

  it('parses "DD-MM-YYYY HH:mm" strings', () => {
    const d = parseFlexibleDate('16-07-2026 13:19')
    expect(d.isValid()).toBe(true)
    expect(d.format('YYYY-MM-DD HH:mm')).toBe('2026-07-16 13:19')
  })

  it('parses date-only "DD-MM-YYYY" strings', () => {
    const d = parseFlexibleDate('16-07-2026')
    expect(d.isValid()).toBe(true)
    expect(d.format('YYYY-MM-DD')).toBe('2026-07-16')
  })

  it('returns an invalid dayjs for garbage input', () => {
    expect(parseFlexibleDate('not-a-date').isValid()).toBe(false)
  })
})

describe('formatNotificationDateTime', () => {
  it('formats an ISO timestamp as "D MMM YYYY, h:mm A"', () => {
    // Local-time ISO (no Z) so the assertion is timezone-independent.
    expect(formatNotificationDateTime('2026-05-08T14:14:00')).toBe('8 May 2026, 2:14 PM')
  })

  it('formats a "DD-MM-YYYY HH:mm" timestamp (the real API format)', () => {
    expect(formatNotificationDateTime('16-07-2026 13:19')).toBe('16 Jul 2026, 1:19 PM')
  })

  it('formats an early morning time with AM', () => {
    expect(formatNotificationDateTime('2026-12-01T09:05:00')).toBe('1 Dec 2026, 9:05 AM')
  })

  it('returns an empty string for an unparseable value', () => {
    expect(formatNotificationDateTime('not-a-date')).toBe('')
    expect(formatNotificationDateTime('')).toBe('')
  })
})

describe('formatTableDateTime', () => {
  it('formats a "DD-MM-YYYY HH:mm" timestamp (the real API format) as "DD-MM-YYYY · h:mm A"', () => {
    expect(formatTableDateTime('16-07-2026 15:44')).toBe('16-07-2026 · 3:44 PM')
  })

  it('formats an early-morning time with AM and no leading hour zero', () => {
    expect(formatTableDateTime('16-07-2026 09:05')).toBe('16-07-2026 · 9:05 AM')
  })

  it('formats an ISO timestamp (local time)', () => {
    // Local-time ISO (no Z) so the assertion is timezone-independent.
    expect(formatTableDateTime('2026-07-16T15:44:00')).toBe('16-07-2026 · 3:44 PM')
  })

  it('returns an empty string for an unparseable or empty value', () => {
    expect(formatTableDateTime('not-a-date')).toBe('')
    expect(formatTableDateTime('')).toBe('')
  })
})

// MET-1309 — the interest-table detail "Created" field showed "Invalid Date"
// because the backend timestamp is not always ISO.
describe('formatLongDate', () => {
  it('formats a "DD-MM-YYYY HH:mm" timestamp (the real API format) as "DD MMM YYYY"', () => {
    expect(formatLongDate('16-07-2026 15:44')).toBe('16 Jul 2026')
  })

  it('formats a date-only "DD-MM-YYYY" value', () => {
    expect(formatLongDate('16-07-2026')).toBe('16 Jul 2026')
  })

  it('formats an ISO timestamp (local time)', () => {
    expect(formatLongDate('2026-07-16T15:44:00')).toBe('16 Jul 2026')
  })

  it('returns the em-dash fallback for missing or unparseable values', () => {
    expect(formatLongDate('not-a-date')).toBe('—')
    expect(formatLongDate('')).toBe('—')
    expect(formatLongDate(null)).toBe('—')
    expect(formatLongDate(undefined)).toBe('—')
  })

  it('honours a custom fallback', () => {
    expect(formatLongDate(undefined, '')).toBe('')
  })
})

describe('formatShortDate', () => {
  it('formats both API shapes as "DD-MM-YYYY"', () => {
    expect(formatShortDate('16-07-2026 15:44')).toBe('16-07-2026')
    expect(formatShortDate('2026-07-16T15:44:00')).toBe('16-07-2026')
  })

  it('returns the em-dash fallback for missing or unparseable values', () => {
    expect(formatShortDate('not-a-date')).toBe('—')
    expect(formatShortDate(undefined)).toBe('—')
  })
})

describe('dateSortValue', () => {
  it('sorts both API shapes chronologically', () => {
    expect(dateSortValue('15-07-2026 12:00')).toBeLessThan(dateSortValue('16-07-2026 12:00'))
    expect(dateSortValue('2026-07-15T12:00:00')).toBeLessThan(dateSortValue('16-07-2026 12:00'))
  })

  it('treats equal timestamps in either shape as equal', () => {
    expect(dateSortValue('16-07-2026 13:19')).toBe(dateSortValue('2026-07-16T13:19:00'))
  })

  it('sorts missing/unparseable values last instead of returning NaN', () => {
    expect(dateSortValue('not-a-date')).toBe(Number.POSITIVE_INFINITY)
    expect(dateSortValue(undefined)).toBe(Number.POSITIVE_INFINITY)
    expect(dateSortValue('16-07-2026 12:00')).toBeLessThan(dateSortValue(''))
  })
})

describe('formatRelativeTime', () => {
  const now = dayjs('2026-07-16T12:00:00').valueOf()

  it('returns "just now" for a very recent timestamp', () => {
    expect(formatRelativeTime('2026-07-16T11:59:30', now)).toBe('just now')
  })

  it('returns minutes ago', () => {
    expect(formatRelativeTime('2026-07-16T11:45:00', now)).toBe('15m ago')
  })

  it('returns hours ago', () => {
    expect(formatRelativeTime('2026-07-16T09:00:00', now)).toBe('3h ago')
  })

  it('returns days ago', () => {
    expect(formatRelativeTime('2026-07-15T12:00:00', now)).toBe('1d ago')
  })

  it('parses the real "DD-MM-YYYY HH:mm" format for relative time', () => {
    expect(formatRelativeTime('16-07-2026 09:00', now)).toBe('3h ago')
    expect(formatRelativeTime('15-07-2026 12:00', now)).toBe('1d ago')
  })

  it('treats future timestamps as "just now" (no negative output)', () => {
    expect(formatRelativeTime('2026-07-16T13:00:00', now)).toBe('just now')
  })

  it('returns an empty string for an unparseable value (no NaN)', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('')
  })
})

describe('isFutureDate', () => {
  const today = dayjs('2026-07-16')

  it('returns true for a date after today', () => {
    expect(isFutureDate(dayjs('2026-07-17'), today)).toBe(true)
  })

  it('returns false for today and past dates', () => {
    expect(isFutureDate(dayjs('2026-07-16'), today)).toBe(false)
    expect(isFutureDate(dayjs('2026-07-15'), today)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isFutureDate(null, today)).toBe(false)
  })
})

describe('isPastDate', () => {
  const now = dayjs('2026-07-16T13:30:00')

  it('returns true for a day before today', () => {
    expect(isPastDate(dayjs('2026-07-15'), now)).toBe(true)
    expect(isPastDate(dayjs('2025-12-31'), now)).toBe(true)
  })

  // MET-1070 — today must stay selectable even though "now" is mid-afternoon.
  it('returns false for today regardless of the time of day', () => {
    expect(isPastDate(dayjs('2026-07-16T00:00:00'), now)).toBe(false)
    expect(isPastDate(dayjs('2026-07-16T13:30:00'), now)).toBe(false)
    expect(isPastDate(dayjs('2026-07-16T23:59:00'), now)).toBe(false)
  })

  it('returns false for a future day', () => {
    expect(isPastDate(dayjs('2026-07-17'), now)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isPastDate(null, now)).toBe(false)
  })
})

describe('isPastTimeOnDate', () => {
  const now = dayjs('2026-07-16T13:30:00')
  const today = dayjs('2026-07-16')
  const tomorrow = dayjs('2026-07-17')

  it('returns true for a time earlier today', () => {
    expect(isPastTimeOnDate(today, '09:00', now)).toBe(true)
    expect(isPastTimeOnDate(today, '13:29', now)).toBe(true)
  })

  it('returns false for the current minute and later times today', () => {
    expect(isPastTimeOnDate(today, '13:30', now)).toBe(false)
    expect(isPastTimeOnDate(today, '13:31', now)).toBe(false)
    expect(isPastTimeOnDate(today, '23:00', now)).toBe(false)
  })

  it('returns false for any time on a different day', () => {
    // A future date accepts an early time — it is not "past" there.
    expect(isPastTimeOnDate(tomorrow, '00:01', now)).toBe(false)
    expect(isPastTimeOnDate(dayjs('2026-07-15'), '09:00', now)).toBe(false)
  })

  it('returns false when the date or time is missing', () => {
    expect(isPastTimeOnDate(null, '09:00', now)).toBe(false)
    expect(isPastTimeOnDate(undefined, '09:00', now)).toBe(false)
    expect(isPastTimeOnDate(today, undefined, now)).toBe(false)
    expect(isPastTimeOnDate(today, '', now)).toBe(false)
  })

  it('returns false for an unparseable time (the required/pattern rule owns that)', () => {
    expect(isPastTimeOnDate(today, 'not-a-time', now)).toBe(false)
    expect(isPastTimeOnDate(today, '09:xx', now)).toBe(false)
  })

  it('ignores the time-of-day carried by the date argument', () => {
    // The picker hands over a Dayjs that may carry any time — only the day matters.
    expect(isPastTimeOnDate(dayjs('2026-07-16T23:00:00'), '09:00', now)).toBe(true)
    expect(isPastTimeOnDate(dayjs('2026-07-16T00:00:00'), '18:00', now)).toBe(false)
  })
})
