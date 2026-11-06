import { WEEKDAY_KEYS } from './constants'
import type { PartnerTable, TableAvailability, TimeRange, WeekDraft, WeekdayKey } from './types'

/**
 * Time and weekday conversion between the wire and the editor.
 *
 * The wire is `HH:MM` 24-hour and Sunday-first; the design shows 12-hour times
 * and Monday-first. Every conversion lives here — pure and translator-free — so
 * the boundaries are testable without rendering the modal, and so no component
 * hand-rolls a time parse.
 *
 * The editor holds **wire format** internally and converts only for display.
 * The prototype did the opposite (state held `"6:00 PM"` strings, parsed back
 * with a regex on submit), which is how an unparseable time could reach the API.
 */

const WIRE_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Strict `HH:MM` 24-hour: `09:00` passes, `9:00` and `24:00` do not. */
export function isWireTime(value: string): boolean {
  return WIRE_TIME.test(value)
}

/**
 * Minutes since midnight, or null when the value is not a wire time.
 *
 * The primitive behind every ordering rule — `end > start`, the no-cross-midnight
 * check (which is the same comparison) and the per-day overlap scan.
 */
export function minutesOf(value: string): number | null {
  const match = WIRE_TIME.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/**
 * `"18:00"` → `"6:00 PM"`, for the card chips and the picker.
 *
 * Anything that is not a wire time is returned verbatim rather than mangled into
 * `"NaN:NaN"` — if the backend ever sends an unexpected shape the card should
 * show it, not hide it behind a broken conversion.
 */
export function toDisplayTime(value: string): string {
  const total = minutesOf(value)
  if (total === null) return value

  const hours24 = Math.floor(total / 60)
  const minutes = total % 60
  const suffix = hours24 < 12 ? 'AM' : 'PM'
  // 00:xx and 12:xx both read as 12 — midnight is 12 AM, noon is 12 PM.
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12

  return `${String(hours12)}:${String(minutes).padStart(2, '0')} ${suffix}`
}

/** All seven weekdays, all Closed. */
export function emptyAvailability(): TableAvailability {
  return WEEKDAY_KEYS.reduce<TableAvailability>((acc, day) => {
    acc[day] = []
    return acc
  }, {} as TableAvailability)
}

/** Keeps only the two fields the wire defines, so nothing extra is echoed back. */
function readRanges(value: unknown): TimeRange[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry): TimeRange[] => {
    if (typeof entry !== 'object' || entry === null) return []
    const { start, end } = entry as { start?: unknown; end?: unknown }
    return typeof start === 'string' && typeof end === 'string' ? [{ start, end }] : []
  })
}

/**
 * Guarantees the seven-key shape the week render assumes.
 *
 * The spec promises all seven keys on every read, so this is belt-and-braces
 * rather than a documented case — but a single missing key would otherwise throw
 * while mapping the week, and an unexpected key (`"7"`, `"mon"`) has to be
 * dropped here or it would be echoed straight back into a 422.
 */
export function normaliseAvailability(raw: unknown): TableAvailability {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>

  return WEEKDAY_KEYS.reduce<TableAvailability>((acc, day) => {
    acc[day] = readRanges(source[day])
    return acc
  }, {} as TableAvailability)
}

/** A new table: every day closed, no ranges. */
export function emptyWeekDraft(): WeekDraft {
  return WEEKDAY_KEYS.reduce<WeekDraft>((acc, day) => {
    acc[day] = { open: false, ranges: [] }
    return acc
  }, {} as WeekDraft)
}

/**
 * Seeds the editor from a table.
 *
 * `open` is derived — a day is open exactly when it has at least one range
 * (BR-04) — and the ranges are copied rather than shared so editing the modal
 * never mutates the cached list.
 */
export function weekDraftFrom(table: PartnerTable): WeekDraft {
  const availability = normaliseAvailability(table.availability)

  return WEEKDAY_KEYS.reduce<WeekDraft>((acc, day) => {
    const ranges = availability[day]
    acc[day] = { open: ranges.length > 0, ranges: ranges.map((range) => ({ ...range })) }
    return acc
  }, {} as WeekDraft)
}

/**
 * Builds the request body's `availability` from the editor.
 *
 * Always all seven keys, with `[]` for a closed day. That completeness is
 * load-bearing on PATCH: the write is a full replace, so a day left out would be
 * read as "the partner closed it" and would silently wipe hours nobody touched
 * (BR-07).
 */
export function availabilityFrom(days: WeekDraft): TableAvailability {
  return WEEKDAY_KEYS.reduce<TableAvailability>((acc, day) => {
    const { open, ranges } = days[day]
    acc[day] = open ? ranges.map((range) => ({ ...range })) : []
    return acc
  }, {} as TableAvailability)
}

/** Ranges sorted by start time; unparseable entries sort last. */
export function sortedByStart(ranges: TimeRange[]): TimeRange[] {
  return [...ranges].sort(
    (a, b) =>
      (minutesOf(a.start) ?? Number.MAX_SAFE_INTEGER) -
      (minutesOf(b.start) ?? Number.MAX_SAFE_INTEGER),
  )
}

/** True when the weekday key is one the wire accepts. */
export function isWeekdayKey(value: string): value is WeekdayKey {
  return (WEEKDAY_KEYS as readonly string[]).includes(value)
}
