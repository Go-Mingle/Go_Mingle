import { describe, it, expect } from 'vitest'
import {
  formatAbsolute,
  isDateOutsideWindow,
  relativeTime,
  resolveDeepLink,
  unreadBadgeLabel,
} from '../format'

/** A fixed "now" so every boundary can be probed without freezing the clock. */
const NOW = new Date('2026-05-08T14:14:00+05:00').getTime()

/** `NOW` minus an offset, as the wire would send it — with a +05:00 offset. */
function ago(ms: number): string {
  return new Date(NOW - ms).toISOString()
}

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

describe('relativeTime — the ladder', () => {
  it('reads "just now" under a minute', () => {
    expect(relativeTime(ago(0), NOW)).toEqual({ kind: 'key', key: 'justNow' })
    expect(relativeTime(ago(59_000), NOW)).toEqual({ kind: 'key', key: 'justNow' })
  })

  it('switches to minutes exactly at one minute', () => {
    expect(relativeTime(ago(MINUTE), NOW)).toEqual({
      kind: 'count',
      key: 'minutesAgo',
      count: 1,
    })
  })

  it('counts whole minutes under an hour', () => {
    expect(relativeTime(ago(5 * MINUTE), NOW)).toEqual({
      kind: 'count',
      key: 'minutesAgo',
      count: 5,
    })
    expect(relativeTime(ago(59 * MINUTE), NOW)).toEqual({
      kind: 'count',
      key: 'minutesAgo',
      count: 59,
    })
  })

  it('switches to hours exactly at one hour', () => {
    expect(relativeTime(ago(HOUR), NOW)).toEqual({ kind: 'count', key: 'hoursAgo', count: 1 })
  })

  it('counts whole hours under a day', () => {
    expect(relativeTime(ago(23 * HOUR), NOW)).toEqual({
      kind: 'count',
      key: 'hoursAgo',
      count: 23,
    })
  })

  it('switches to days exactly at 24 hours', () => {
    expect(relativeTime(ago(DAY), NOW)).toEqual({ kind: 'count', key: 'daysAgo', count: 1 })
  })

  it('counts days up to six', () => {
    expect(relativeTime(ago(6 * DAY), NOW)).toEqual({ kind: 'count', key: 'daysAgo', count: 6 })
  })

  /** The cutover: seven days is where relative stops and an absolute date starts. */
  it('switches to an absolute date at seven days', () => {
    const result = relativeTime(ago(7 * DAY), NOW)

    expect(result.kind).toBe('absolute')
    expect(result).not.toHaveProperty('count')
  })

  it('stays absolute for anything older', () => {
    expect(relativeTime(ago(400 * DAY), NOW).kind).toBe('absolute')
  })

  /**
   * Clock skew between the server and the browser can put `createdAt` slightly in the
   * future. The prototype rendered "-1m ago" for this.
   */
  it('reads a future timestamp as "just now" rather than a negative count', () => {
    expect(relativeTime(ago(-30_000), NOW)).toEqual({ kind: 'key', key: 'justNow' })
    expect(relativeTime(ago(-5 * HOUR), NOW)).toEqual({ kind: 'key', key: 'justNow' })
  })

  /** Shows what arrived rather than hiding it behind "Invalid Date". */
  it.each(['not-a-date', '', '15-04-2026'])('falls back to the raw value for %o', (value) => {
    expect(relativeTime(value, NOW)).toEqual({ kind: 'absolute', absolute: value })
  })

  /**
   * The offset is load-bearing and must not be normalised. Both forms name the same
   * instant, so both must land on the same rung.
   */
  it('treats a +05:00 offset and its Z equivalent as the same instant', () => {
    const karachi = relativeTime('2026-05-08T14:00:00+05:00', NOW)
    const utc = relativeTime('2026-05-08T09:00:00Z', NOW)

    expect(karachi).toEqual(utc)
    expect(karachi).toEqual({ kind: 'count', key: 'minutesAgo', count: 14 })
  })

  it('defaults `now` to the current time', () => {
    expect(relativeTime(new Date().toISOString())).toEqual({ kind: 'key', key: 'justNow' })
  })
})

describe('formatAbsolute', () => {
  /** The design's format, and the one place the portal is not DD-MM-YYYY. */
  it('renders the design format', () => {
    expect(formatAbsolute(new Date('2026-05-08T14:14:00+05:00'))).toBe('8 May 2026, 2:14 PM')
  })

  it('upper-cases the meridiem', () => {
    const rendered = formatAbsolute(new Date('2026-05-08T09:05:00+05:00'))

    expect(rendered).toBe('8 May 2026, 9:05 AM')
    expect(rendered).not.toContain('am')
  })

  /**
   * Rendered in Asia/Karachi, not the viewer's zone — the prototype's dayjs call got
   * this wrong. 22:30 UTC is 02:30 the next day in Karachi.
   */
  it('converts to Asia/Karachi rather than local time', () => {
    expect(formatAbsolute(new Date('2026-05-08T22:30:00Z'))).toBe('9 May 2026, 3:30 AM')
  })

  /**
   * The regression this guards is environment-dependent, which is why it is asserted at
   * both boundaries.
   *
   * `hour12: true` does not pin the hour cycle — it lets the locale and the runtime's ICU
   * version pick between `h12` (1–12) and `h11` (0–11). `en-GB` resolves to `h12` on ICU 77
   * but `h11` on older builds, where midnight renders "0:00 AM" and noon "0:00 PM". The
   * formatter names `hourCycle: 'h12'` so the output cannot vary by build.
   */
  it('renders midnight and noon unambiguously', () => {
    expect(formatAbsolute(new Date('2026-05-08T00:00:00+05:00'))).toBe('8 May 2026, 12:00 AM')
    expect(formatAbsolute(new Date('2026-05-08T12:00:00+05:00'))).toBe('8 May 2026, 12:00 PM')
  })

  it('never renders a zero hour, whatever the runtime ICU resolves', () => {
    for (const hour of [0, 1, 11, 12, 13, 23]) {
      const iso = `2026-05-08T${String(hour).padStart(2, '0')}:30:00+05:00`
      const rendered = formatAbsolute(new Date(iso))

      expect(rendered).not.toMatch(/\b0:\d{2}\s?(AM|PM)/)
      expect(rendered).toMatch(/\b(1[0-2]|[1-9]):30 (AM|PM)$/)
    }
  })

  it('crosses midday and midnight in the right half of the clock', () => {
    expect(formatAbsolute(new Date('2026-05-08T11:59:00+05:00'))).toBe('8 May 2026, 11:59 AM')
    expect(formatAbsolute(new Date('2026-05-08T12:01:00+05:00'))).toBe('8 May 2026, 12:01 PM')
    expect(formatAbsolute(new Date('2026-05-08T23:59:00+05:00'))).toBe('8 May 2026, 11:59 PM')
  })
})

describe('resolveDeepLink', () => {
  /**
   * The whole reason this function exists: the producer writes a path under
   * `/restaurant-profile`, which is not a route in this app.
   */
  it('strips the /restaurant-profile prefix the producer writes', () => {
    expect(resolveDeepLink('/restaurant-profile/interest-tables/it-1')).toBe(
      '/interest-tables/it-1',
    )
  })

  it('preserves the query string, which carries the tab', () => {
    expect(resolveDeepLink('/restaurant-profile/interest-tables/it-1?tab=bookings')).toBe(
      '/interest-tables/it-1?tab=bookings',
    )
  })

  /** Tolerating both shapes is what lets a producer fix land without a client change. */
  it('passes through a path that is already correct', () => {
    expect(resolveDeepLink('/interest-tables/it-1')).toBe('/interest-tables/it-1')
    expect(resolveDeepLink('/interest-tables/it-1?tab=bookings')).toBe(
      '/interest-tables/it-1?tab=bookings',
    )
  })

  it('trims surrounding whitespace', () => {
    expect(resolveDeepLink('  /interest-tables/it-1  ')).toBe('/interest-tables/it-1')
  })

  /** Null is not an error — BR-10 says such a row still marks read, it just goes nowhere. */
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['whitespace only', '   '],
  ])('returns null for %s', (_label, value) => {
    expect(resolveDeepLink(value)).toBeNull()
  })

  /** A path, by contract. An absolute URL is not ours to route. */
  it.each([
    'https://evil.example.com/interest-tables/it-1',
    'http://localhost/interest-tables/it-1',
    'interest-tables/it-1',
  ])('returns null for the non-path %o', (value) => {
    expect(resolveDeepLink(value)).toBeNull()
  })

  /**
   * A protocol-relative URL starts with a slash too, so the path check alone lets it
   * through — and `navigate('//host/x')` leaves the app. These paths come from the
   * database, so passing one on would be an open redirect.
   */
  it.each(['//evil.example.com/x', '//evil.example.com', '///evil.example.com/x'])(
    'returns null for the protocol-relative %o',
    (value) => {
      expect(resolveDeepLink(value)).toBeNull()
    },
  )

  it('returns null when stripping the prefix leaves nothing', () => {
    expect(resolveDeepLink('/restaurant-profile/')).toBeNull()
  })
})

describe('unreadBadgeLabel', () => {
  it('renders the count', () => {
    expect(unreadBadgeLabel(6, 99)).toBe('6')
  })

  it('renders the cap exactly at the cap', () => {
    expect(unreadBadgeLabel(99, 99)).toBe('99')
  })

  it('caps above the cap', () => {
    expect(unreadBadgeLabel(100, 99)).toBe('99+')
    expect(unreadBadgeLabel(4213, 99)).toBe('99+')
  })

  /** Null, not "0" — the badge is removed entirely at zero, leaving a bell outline. */
  it.each([
    ['zero', 0],
    ['a negative count', -3],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('returns null for %s', (_label, count) => {
    expect(unreadBadgeLabel(count, 99)).toBeNull()
  })
})

describe('isDateOutsideWindow', () => {
  const WINDOW = 90
  /** A Karachi mid-afternoon, so day boundaries are unambiguous. */
  const TODAY = new Date('2026-05-08T14:00:00+05:00').getTime()

  function day(iso: string): Date {
    return new Date(`${iso}T12:00:00+05:00`)
  }

  it('allows today', () => {
    expect(isDateOutsideWindow(day('2026-05-08'), WINDOW, TODAY)).toBe(false)
  })

  it('allows yesterday and last week', () => {
    expect(isDateOutsideWindow(day('2026-05-07'), WINDOW, TODAY)).toBe(false)
    expect(isDateOutsideWindow(day('2026-05-01'), WINDOW, TODAY)).toBe(false)
  })

  /** A future end date is refused by the API, so the picker must not offer one. */
  it('rejects tomorrow and beyond', () => {
    expect(isDateOutsideWindow(day('2026-05-09'), WINDOW, TODAY)).toBe(true)
    expect(isDateOutsideWindow(day('2027-01-01'), WINDOW, TODAY)).toBe(true)
  })

  it('allows the oldest day inside the window', () => {
    expect(isDateOutsideWindow(day('2026-02-07'), WINDOW, TODAY)).toBe(false)
  })

  /**
   * Older than the window is silently clamped rather than refused, which is worse than an
   * error — the range would simply return nothing and read as a bug.
   */
  it('rejects the day before the cutoff', () => {
    expect(isDateOutsideWindow(day('2026-02-06'), WINDOW, TODAY)).toBe(true)
    expect(isDateOutsideWindow(day('2025-05-08'), WINDOW, TODAY)).toBe(true)
  })

  /** Judged by calendar day in Karachi, not by the instant. */
  it('treats any time on today as today', () => {
    expect(isDateOutsideWindow(new Date('2026-05-08T00:05:00+05:00'), WINDOW, TODAY)).toBe(false)
    expect(isDateOutsideWindow(new Date('2026-05-08T23:55:00+05:00'), WINDOW, TODAY)).toBe(false)
  })

  it('honours a different window length', () => {
    expect(isDateOutsideWindow(day('2026-05-01'), 3, TODAY)).toBe(true)
    expect(isDateOutsideWindow(day('2026-05-06'), 3, TODAY)).toBe(false)
  })
})
