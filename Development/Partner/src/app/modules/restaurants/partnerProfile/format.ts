/**
 * Display and wire formatting for the partner restaurant profile.
 *
 * The phone pair is the load-bearing part: the API requires compact E.164
 * (`+923001234567`), while the spec's own examples and the design show
 * `+92 300 123 4567`. Those spaces are display only and are rejected on the
 * wire, so every phone is normalised on the way out and prettified on the way in.
 */

/** Anything that is not a digit or a leading `+`. */
const NON_E164 = /[^\d+]/g

/**
 * Normalises a phone for the wire: strips spaces, dashes and brackets, and keeps
 * a single leading `+`. Returns an empty string for a blank input so callers can
 * decide whether to omit the field.
 */
export function toE164(value: string | null | undefined): string {
  if (!value) return ''
  const compact = value.replace(NON_E164, '')
  if (!compact) return ''
  // A `+` is only meaningful in front; any others are typos.
  const digits = compact.replace(/\+/g, '')
  return compact.startsWith('+') ? `+${digits}` : digits
}

/**
 * Groups an E.164 number for display — `+923001234567` → `+92 300 123 4567`.
 * Falls back to the raw value for anything that is not a recognisable
 * international number, so nothing is ever hidden from the partner.
 */
export function formatPhoneForDisplay(value: string | null | undefined): string {
  const compact = toE164(value)
  if (!compact.startsWith('+')) return value?.trim() ?? ''

  const digits = compact.slice(1)
  // Karachi landlines: +92 21 XXXX XXXX.
  if (digits.length === 12 && digits.startsWith('9221')) {
    return `+92 21 ${digits.slice(4, 8)} ${digits.slice(8)}`
  }
  // Pakistani mobiles (92 + 10 digits, e.g. 300 123 4567) are the common case.
  if (digits.length === 12 && digits.startsWith('92')) {
    return `+92 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
  }
  // Other 12-digit international numbers (e.g. UAE 971 + 9).
  if (digits.length === 12) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
  }
  if (digits.length > 6) {
    return `+${digits.slice(0, 3)} ${digits.slice(3)}`
  }
  return compact
}

/**
 * True when a profile field actually carries a value.
 *
 * A fresh Draft returns `null` for most fields — including the name — so
 * placeholders are driven off this rather than off empty string.
 */
export function hasProfileValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

/** A field's display value, or the caller's "not provided" copy. */
export function displayOr(value: string | null | undefined, fallback: string): string {
  return hasProfileValue(value) ? (value as string).trim() : fallback
}

/**
 * A decline date, normalised to the documented `YYYY-MM-DD` (MET-1250).
 *
 * J6A sends `rejectedAt` as `DD-MM-YYYY HH:MM` in Asia/Karachi, but the API
 * convention specifies `YYYY-MM-DD` and BR-13 specifies a *date*, not a
 * timestamp — so the component order was reversed and a time was shown where
 * none was asked for. The reorder happens here rather than waiting on the
 * backend, so the partner-facing surface is right whichever shape arrives:
 *
 *  - `DD-MM-YYYY[ HH:MM]` — reordered as pure string work. Deliberately not a
 *    dayjs pass-through: `dayjs('19-08-2026')` reads the leading `19` as a month
 *    and yields `Invalid Date`, and reparsing risks a timezone shift moving the
 *    day.
 *  - `YYYY-MM-DD[ HH:MM]` with no offset — already Asia/Karachi per the contract,
 *    so the date part is taken as-is. No conversion, no day shift.
 *  - an instant carrying `Z` or `±HH:MM` — the calendar day genuinely depends on
 *    the zone, so it is converted to Asia/Karachi rather than sliced. Same `Intl`
 *    idiom as `partnerMedia/format.formatUploadedAt`.
 *
 * Anything unrecognised is rendered verbatim: a shape we did not anticipate is
 * still information the partner should see, and a dash would hide it.
 */

/** `DD-MM-YYYY`, with or without a trailing time — what J6A sends today. */
const DAY_FIRST = /^(\d{2})-(\d{2})-(\d{4})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/

/** `YYYY-MM-DD` with an optional time and no offset — already Asia/Karachi. */
const ISO_LOCAL = /^(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)?$/

/** A `Z` or `±HH:MM` suffix, which makes the calendar day zone-dependent. */
const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/

/** `en-CA` is the locale whose short date is already `YYYY-MM-DD`. */
const KARACHI_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Karachi',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function displayProfileDate(value: string | null | undefined): string {
  const raw = value?.trim()
  if (!raw) return '—'

  const dayFirst = DAY_FIRST.exec(raw)
  if (dayFirst) {
    const [, day, month, year] = dayFirst
    return `${year}-${month}-${day}`
  }

  const isoLocal = ISO_LOCAL.exec(raw)
  if (isoLocal) return isoLocal[1]

  if (HAS_OFFSET.test(raw)) {
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) return KARACHI_DATE.format(parsed)
  }

  return raw
}

/** Commission is admin-derived from the category and shown as a percentage. */
export function formatCommission(percent: number | null | undefined, fallback: string): string {
  return typeof percent === 'number' && Number.isFinite(percent) ? `${percent}%` : fallback
}

/**
 * Drops keys whose value is undefined or an empty string.
 *
 * The API treats an absent key as "leave untouched" and does not accept `null`
 * as a way to clear a field, so a blank input must be omitted rather than sent.
 */
export function omitEmpty<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === undefined || value === null) return false
      return typeof value !== 'string' || value.trim().length > 0
    }),
  ) as Partial<T>
}
