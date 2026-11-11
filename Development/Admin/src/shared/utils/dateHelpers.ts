import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

// Backend timestamps arrive in two shapes: ISO 8601 (e.g. "2026-05-08T10:14:00Z")
// and a display-style "DD-MM-YYYY HH:MM" (e.g. "16-07-2026 13:19"). dayjs only
// parses the former by default, so non-ISO values must be parsed with an explicit
// format list — otherwise they read as "Invalid Date".
const ISO_LIKE = /^\d{4}-\d{2}-\d{2}/

/**
 * Parses a backend timestamp that may be ISO 8601 or "DD-MM-YYYY[ HH:mm]".
 * Returns a dayjs object that may be invalid — callers should guard with `.isValid()`.
 */
export function parseFlexibleDate(value: string | null | undefined): Dayjs {
  // A missing value must read as invalid, not as "now" — `dayjs(undefined)`
  // returns the current time, which would silently fake a timestamp.
  if (!value) return dayjs(NaN)
  if (ISO_LIKE.test(value)) return dayjs(value)
  return dayjs(value, ['DD-MM-YYYY HH:mm', 'DD-MM-YYYY'], true)
}

/**
 * Safely narrows an unknown filter value to a [Dayjs, Dayjs] tuple.
 * Replaces scattered `as unknown as [Dayjs, Dayjs] | null` casts in table filter handlers.
 */
export function toDateRange(value: unknown): [Dayjs, Dayjs] | null {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    dayjs.isDayjs(value[0]) &&
    dayjs.isDayjs(value[1])
  ) {
    return value as [Dayjs, Dayjs]
  }
  return null
}

/**
 * Formats an ISO date string as a zero-padded DD-MM-YYYY HH:MM string
 * in the Asia/Karachi timezone (UTC+5).
 *
 * Uses the built-in Intl.DateTimeFormat API — no additional dependencies.
 *
 * @example
 * formatKarachiDateTime('2026-06-05T10:30:00.000Z') // '05-06-2026 14:30'
 */
export function formatKarachiDateTime(isoString: string): string {
  const date = new Date(isoString)

  // Guard against non-ISO / unparseable input. `Intl.DateTimeFormat.formatToParts`
  // throws `RangeError: Invalid time value` on an Invalid Date, which would crash
  // the surrounding render. Some endpoints already return a display-ready
  // `DD-MM-YYYY HH:MM` string — in that case just echo it back unchanged.
  if (Number.isNaN(date.getTime())) {
    return isoString
  }

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '00'

  return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')}`
}

/**
 * Formats an ISO timestamp for the notifications listing, e.g.
 * '2026-05-08T14:14:00Z' → '8 May 2026, 2:14 PM'. Returns an empty string for
 * missing/unparseable input so the UI never shows "Invalid Date".
 */
export function formatNotificationDateTime(isoString: string): string {
  const date = parseFlexibleDate(isoString)
  return date.isValid() ? date.format('D MMM YYYY, h:mm A') : ''
}

/**
 * Formats a backend timestamp for table "Date & Time" cells, e.g.
 * '16-07-2026 15:44' → '16-07-2026 · 3:44 PM'. Accepts both ISO and
 * 'DD-MM-YYYY HH:mm' shapes via parseFlexibleDate. Returns '' when unparseable.
 */
export function formatTableDateTime(isoString: string): string {
  const date = parseFlexibleDate(isoString)
  return date.isValid() ? date.format('DD-MM-YYYY [·] h:mm A') : ''
}

/**
 * Formats a backend timestamp as a long calendar date, e.g.
 * '16-07-2026 15:44' → '16 Jul 2026'. Accepts both ISO and 'DD-MM-YYYY HH:mm'
 * shapes via parseFlexibleDate, and returns `fallback` when the value is
 * missing or unparseable so the UI never shows "Invalid Date".
 */
export function formatLongDate(value: string | null | undefined, fallback = '—'): string {
  if (!value) return fallback
  const date = parseFlexibleDate(value)
  return date.isValid() ? date.format('DD MMM YYYY') : fallback
}

/**
 * Formats a backend timestamp as a numeric date, e.g.
 * '16-07-2026 15:44' → '16-07-2026'. Same tolerant parsing and fallback
 * behaviour as formatLongDate.
 */
export function formatShortDate(value: string | null | undefined, fallback = '—'): string {
  if (!value) return fallback
  const date = parseFlexibleDate(value)
  return date.isValid() ? date.format('DD-MM-YYYY') : fallback
}

/**
 * Sort key for a backend timestamp column. Unparseable/missing values sort
 * last (ascending) instead of poisoning the comparator with NaN.
 */
export function dateSortValue(value: string | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY
  const date = parseFlexibleDate(value)
  return date.isValid() ? date.valueOf() : Number.POSITIVE_INFINITY
}

/**
 * Compact relative time for the notification bell, e.g. 'just now', '5m ago',
 * '3h ago', '1d ago'. Returns an empty string for missing/unparseable input
 * (guards against the previous "NaN m ago" bug). `now` is injectable for tests.
 */
export function formatRelativeTime(isoString: string, now: number = Date.now()): string {
  const date = parseFlexibleDate(isoString)
  if (!date.isValid()) return ''

  const diffMs = now - date.valueOf()
  if (diffMs < 60_000) return 'just now'

  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `${mins}m ago`

  const hours = Math.floor(diffMs / 3_600_000)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(diffMs / 86_400_000)
  return `${days}d ago`
}

/**
 * Predicate for AntD DatePicker `disabledDate` — blocks dates after today.
 * `now` is injectable for tests.
 */
export function isFutureDate(date: Dayjs | null, now: Dayjs = dayjs()): boolean {
  return !!date && date.isAfter(now, 'day')
}

/**
 * Predicate for AntD DatePicker `disabledDate` — blocks days before today.
 * Today itself is always allowed (an event may still be scheduled later today).
 * `now` is injectable for tests.
 */
/**
 * The current wall-clock time in Pakistan (UTC+05:00, no daylight saving), as a
 * dayjs whose hour/minute/day read as Karachi time whatever the viewer's own
 * time zone is. Interest table dates and times are Pakistan time, so checks such
 * as "has this start time passed?" must use this clock, not the browser's.
 */
export function pakistanNow(nowMs: number = Date.now()): Dayjs {
  const offsetMinutes = new Date(nowMs).getTimezoneOffset()
  return dayjs(nowMs + (5 * 60 + offsetMinutes) * 60_000)
}

export function isPastDate(date: Dayjs | null, now: Dayjs = dayjs()): boolean {
  return !!date && date.isBefore(now, 'day')
}

/**
 * True when the "HH:mm" `time` has already elapsed on `date` — i.e. `date` is
 * the same day as `now` and the time is earlier than the current minute.
 *
 * Only today can have an elapsed time: a future date accepts any time, and past
 * dates are rejected by `isPastDate` before this ever applies. Unset or
 * unparseable input is not reported as past, so the "required" rule owns that
 * error instead of this one. `now` is injectable for tests.
 */
export function isPastTimeOnDate(
  date: Dayjs | null | undefined,
  time: string | undefined,
  now: Dayjs = dayjs(),
): boolean {
  if (!date || !time) return false
  if (!date.isSame(now, 'day')) return false
  const [hours, minutes] = time.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return false
  return date.hour(hours).minute(minutes).isBefore(now, 'minute')
}
