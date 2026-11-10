/** Formatting for the media tabs. */

const DASH = '—'

const UNITS = ['B', 'KB', 'MB', 'GB'] as const

/**
 * Raw bytes → a human size, e.g. `1.2 MB` / `512 KB` / `948 B`.
 *
 * Sizes arrive as raw byte counts (BR-04), so the display value is derived here
 * rather than parsed back out of a pre-formatted string — which is what the
 * prototype had to do.
 *
 * Null renders a dash: media predating J6B has no recorded size, and `0 B`
 * would read as an empty file rather than an unknown one.
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return DASH
  if (bytes === 0) return '0 B'

  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }

  // Bytes are whole; larger units keep one decimal unless it would read as .0.
  const rounded = unit === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${UNITS[unit]}`
}

/**
 * A UTC timestamp rendered in Asia/Karachi as `DD-MM-YYYY HH:MM` (F1 BR-15).
 *
 * Unlike every other date in the portal, `uploadedAt` arrives as raw UTC ISO
 * rather than pre-converted by the backend — so this is the one place the
 * client does the conversion. `Intl` is used rather than a dayjs timezone
 * plugin because it needs no extra bundle and no global plugin registration.
 *
 * An unparseable value renders a dash rather than "Invalid Date".
 */
const KARACHI_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function formatUploadedAt(value: string | null | undefined): string {
  if (!value?.trim()) return DASH

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return DASH

  // en-GB gives "01/05/2026, 13:12"; the portal's convention is "01-05-2026 13:12".
  return KARACHI_FORMAT.format(parsed).replace(/\//g, '-').replace(', ', ' ')
}

/** `bar.jpg` → `JPG`. Used where the server has not already derived a type. */
export function extensionOf(name: string): string {
  const trimmed = name.trim()
  const dot = trimmed.lastIndexOf('.')
  return dot > 0 ? trimmed.slice(dot + 1).toUpperCase() : DASH
}

/** "X of N photos" — `max` is config-driven, so it is never hardcoded. */
export function formatCountOf(count: number, max: number, noun: string): string {
  return `${count} of ${max} ${noun}`
}
