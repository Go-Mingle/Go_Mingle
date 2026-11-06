import { HttpError } from '../../../../shared/api/httpClient'
import { TABLE_LIMITS, WEEKDAY_KEYS } from './constants'
import { isWeekdayKey, isWireTime, minutesOf, sortedByStart } from './format'
import type { DayDraft, TableFormDraft, WeekdayKey } from './types'

/**
 * Table form validation (BR-03, BR-04, BR-06), mirroring the server rule for rule
 * so a partner hits an inline error rather than a round trip and a 422.
 *
 * Pure and translator-injected, so every boundary is testable without rendering
 * the modal.
 *
 * Note what is deliberately **absent**: the prototype's "every range must be at
 * least an hour" rule. It is not in the spec, and the backend accepts a
 * thirty-minute window — a client-only rule there would reject a table the API
 * would happily have created.
 */

/** Messages for one range's two inputs. */
export interface RangeErrors {
  start?: string
  end?: string
}

export interface DayErrors {
  /** Per-range messages, keyed by index. */
  ranges?: Record<number, RangeErrors>
  /**
   * Day-level: an open day with no ranges, an overlap between two of them, or
   * more than the six the backend accepts. None of these belong to a single
   * input, so they render above the day's rows.
   */
  general?: string
}

export interface TableFormErrors {
  name?: string
  days?: Partial<Record<WeekdayKey, DayErrors>>
  /**
   * Anything the server reported that could not be attributed to a field. Shown
   * above the form so a message is never silently dropped.
   */
  general?: string
}

type Translate = (key: string, options?: Record<string, unknown>) => string

const KEY = 'restaurants:partnerTables.form.errors'

/**
 * One range's two inputs.
 *
 * A missing time and a malformed one are different messages: the first is an
 * unfinished row, the second only happens if something bypassed the picker.
 */
function validateRange(start: string, end: string, t: Translate): RangeErrors {
  const errors: RangeErrors = {}

  if (!start.trim()) errors.start = t(`${KEY}.timeRequired`)
  else if (!isWireTime(start)) errors.start = t(`${KEY}.timeInvalid`)

  if (!end.trim()) errors.end = t(`${KEY}.timeRequired`)
  else if (!isWireTime(end)) errors.end = t(`${KEY}.timeInvalid`)

  if (errors.start || errors.end) return errors

  // One comparison covers two rules: `end > start` (BR-06) and the
  // no-cross-midnight ban, since a same-day 22:00–02:00 fails it too.
  const from = minutesOf(start)
  const to = minutesOf(end)
  if (from !== null && to !== null && to <= from) {
    errors.end = t(`${KEY}.endAfterStart`)
  }

  return errors
}

/**
 * True when two of the day's ranges overlap.
 *
 * Touching is fine — 15:00–17:00 next to 17:00–19:00 is a split service, not a
 * conflict — so the comparison is strictly `<`, not `<=`. Ranges that failed the
 * per-range checks are skipped; they already carry their own message.
 */
function hasOverlap(day: DayDraft): boolean {
  const usable = day.ranges.filter((range) => {
    const from = minutesOf(range.start)
    const to = minutesOf(range.end)
    return from !== null && to !== null && to > from
  })

  const ordered = sortedByStart(usable)
  return ordered.some((range, index) => {
    if (index === 0) return false
    const previousEnd = minutesOf(ordered[index - 1].end)
    const start = minutesOf(range.start)
    return previousEnd !== null && start !== null && start < previousEnd
  })
}

function validateDay(day: DayDraft, t: Translate): DayErrors {
  const errors: DayErrors = {}
  if (!day.open) return errors

  // An open day needs at least one complete range (BR-04); toggling it off is how
  // the partner says "closed".
  if (day.ranges.length === 0) {
    errors.general = t(`${KEY}.dayNeedsRange`)
    return errors
  }

  if (day.ranges.length > TABLE_LIMITS.rangesPerDayMax) {
    errors.general = t(`${KEY}.tooManyRanges`, { max: TABLE_LIMITS.rangesPerDayMax })
  }

  const ranges: Record<number, RangeErrors> = {}
  day.ranges.forEach((range, index) => {
    const found = validateRange(range.start, range.end, t)
    if (Object.keys(found).length > 0) ranges[index] = found
  })
  if (Object.keys(ranges).length > 0) errors.ranges = ranges

  if (!errors.general && hasOverlap(day)) {
    errors.general = t(`${KEY}.overlap`)
  }

  return errors
}

export function validateTableDraft(draft: TableFormDraft, t: Translate): TableFormErrors {
  const errors: TableFormErrors = {}

  const name = draft.name.trim()
  if (!name) errors.name = t(`${KEY}.nameRequired`)
  else if (name.length > TABLE_LIMITS.nameMax) {
    errors.name = t(`${KEY}.nameTooLong`, { max: TABLE_LIMITS.nameMax })
  }

  const days: Partial<Record<WeekdayKey, DayErrors>> = {}
  WEEKDAY_KEYS.forEach((key) => {
    const found = validateDay(draft.days[key], t)
    if (Object.keys(found).length > 0) days[key] = found
  })
  if (Object.keys(days).length > 0) errors.days = days

  return errors
}

/** True when anything anywhere in the form is in error. */
export function hasErrors(errors: TableFormErrors): boolean {
  if (errors.name || errors.general) return true

  return Object.values(errors.days ?? {}).some(
    (day) => Boolean(day?.general) || Object.keys(day?.ranges ?? {}).length > 0,
  )
}

const RANGE_FIELDS = ['start', 'end'] as const
type RangeField = (typeof RANGE_FIELDS)[number]

function isRangeField(value: string): value is RangeField {
  return (RANGE_FIELDS as readonly string[]).includes(value)
}

/** `details.fields` values may be a string or a list of them. */
function firstMessage(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value
  if (Array.isArray(value)) {
    const found = value.find((entry) => typeof entry === 'string' && entry.trim())
    if (typeof found === 'string') return found
  }
  return undefined
}

interface RangePath {
  day: WeekdayKey
  index: number
  field: RangeField
}

/**
 * Reads a range path out of a `details.fields` key.
 *
 * The backend documents readable nested paths like `availability.1[0].end`; the
 * dotted `availability.1.0.end` spelling is accepted too, since the spec pins the
 * shape by example rather than by grammar.
 */
function parseRangePath(key: string): RangePath | null {
  const match = /^availability\.(\d)(?:\[(\d+)\]|\.(\d+))\.(\w+)$/.exec(key)
  if (!match) return null

  const [, day, bracketIndex, dotIndex, field] = match
  if (!isWeekdayKey(day) || !isRangeField(field)) return null

  return { day, index: Number(bracketIndex ?? dotIndex), field }
}

/** `availability.3` — a whole day, e.g. an overlap the server caught. */
function parseDayPath(key: string): WeekdayKey | null {
  const match = /^availability\.(\d)$/.exec(key)
  if (!match) return null
  return isWeekdayKey(match[1]) ? match[1] : null
}

function withRangeError(
  days: Partial<Record<WeekdayKey, DayErrors>>,
  path: RangePath,
  message: string,
): void {
  const day = days[path.day] ?? {}
  const ranges = day.ranges ?? {}
  days[path.day] = {
    ...day,
    ranges: { ...ranges, [path.index]: { ...ranges[path.index], [path.field]: message } },
  }
}

/**
 * Turns a 422's `details.fields` into the same error shape the form already
 * renders, so a server-only rule points at the offending input rather than only
 * raising a toast.
 *
 * Every message is surfaced: anything that cannot be attributed to a field lands
 * in `general` instead of being dropped.
 */
export function mapServerFieldErrors(error: unknown): TableFormErrors {
  if (!(error instanceof HttpError)) return {}

  const body = error.responseBody as { error?: { details?: { fields?: unknown } } } | null
  const fields = body?.error?.details?.fields
  if (typeof fields !== 'object' || fields === null) return {}

  const errors: TableFormErrors = {}
  const days: Partial<Record<WeekdayKey, DayErrors>> = {}
  const unattributed: string[] = []

  Object.entries(fields as Record<string, unknown>).forEach(([key, value]) => {
    const message = firstMessage(value)
    if (!message) return

    if (key === 'name') {
      errors.name = message
      return
    }

    const rangePath = parseRangePath(key)
    if (rangePath) {
      withRangeError(days, rangePath, message)
      return
    }

    const dayKey = parseDayPath(key)
    if (dayKey) {
      days[dayKey] = { ...days[dayKey], general: message }
      return
    }

    unattributed.push(message)
  })

  if (Object.keys(days).length > 0) errors.days = days
  if (unattributed.length > 0) errors.general = unattributed.join(' ')

  return errors
}

/**
 * The duplicate-name 409 as a name-field error.
 *
 * The backend sends `details.field: "name"` precisely so this lands on the input
 * rather than in a generic toast, and its own copy ("A table area with this name
 * already exists.") is better than anything we would write — so that is preferred
 * and `fallback` only covers a body that carries no message.
 *
 * `details.field` itself is not read: the error code already says which field this
 * is about, and dropping the message when the detail is absent would be worse
 * than assuming it.
 */
export function mapDuplicateNameError(error: unknown, fallback: string): TableFormErrors {
  if (!(error instanceof HttpError)) return {}

  const body = error.responseBody as { error?: { message?: string } } | null
  return { name: body?.error?.message ?? fallback }
}
