import dayjs from 'dayjs'

/** What Day.js and `Date#toLocaleDateString` render for unparseable input. */
const INVALID_DATE = 'Invalid Date'

/** Shown in place of a date the server did not send, or sent unusable. */
export const DATE_FALLBACK = '—'

export function formatCurrency(amount: number, currency = 'PKR'): string {
  return `${currency} ${amount.toLocaleString()}`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Formats a date for display, substituting {@link DATE_FALLBACK} whenever the
 * value is missing, blank, or unparseable — so a null/garbage `joined` from the
 * API renders "—" rather than the literal "Invalid Date" (MET-1340).
 */
export function formatDateSafe(
  value: unknown,
  format = 'DD MMM YYYY',
  fallback: string = DATE_FALLBACK,
): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback
  const raw = typeof value === 'string' ? value.trim() : value
  if (raw === '' || raw === INVALID_DATE) return fallback
  const parsed = dayjs(raw)
  return parsed.isValid() ? parsed.format(format) : fallback
}

/**
 * Guards a date string the server has *already* formatted for display: passes it
 * through untouched, but substitutes {@link DATE_FALLBACK} when it is missing,
 * blank, or the literal "Invalid Date". Use this instead of
 * {@link formatDateSafe} where re-parsing would risk mangling the server's
 * chosen format.
 */
export function displayServerDate(value: unknown, fallback: string = DATE_FALLBACK): string {
  if (typeof value !== 'string') return fallback
  const raw = value.trim()
  return raw === '' || raw === INVALID_DATE ? fallback : raw
}
