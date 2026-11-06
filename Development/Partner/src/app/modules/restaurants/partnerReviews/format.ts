/**
 * Display helpers for the Reviews tab.
 *
 * Note what is **absent**: any date formatting. Both endpoints send dates already
 * formatted for Asia/Karachi — the list as `15-04-2026`, the modal as `15 Apr 2026` —
 * and they are rendered verbatim. Neither is a parseable ISO string, so running
 * either through `dayjs` yields an Invalid Date. The prototype tab did exactly
 * that, which is why this module has no date helper to be tempted by.
 */

/** Shown wherever a nullable string has no value, matching the rest of the portal. */
export const EM_DASH = '—'

/**
 * Four fields on a review are nullable — the reviewer's name, the interest table's
 * name and topic, and the review text — because a Mingler can be deleted, a topic
 * retired, and a review left as a rating with no words. Every one renders as a dash
 * rather than the string "null".
 */
export function displayOrDash(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : EM_DASH
}

/**
 * The interest table cell shows **both** Name and Topic (BR-04).
 *
 * Returned as a pair rather than a joined string so the cell can style them
 * differently — name prominent, topic secondary — and so a row with one of the two
 * missing degrades to a single line instead of a stray separator.
 */
export function displayInterestTable(table: { name: string | null; topic: string | null }): {
  name: string
  topic: string | null
} {
  const topic = table.topic?.trim()
  return {
    name: displayOrDash(table.name),
    topic: topic ? topic : null,
  }
}

/**
 * Initials for the reviewer avatar.
 *
 * The payload carries no `minglerInitials` — the prototype's fixtures did — so it
 * is derived. First and last word, which reads correctly for both "Sana Khan" and
 * a three-part name. Falls back to a neutral glyph rather than an empty circle when
 * the name is null, which happens for a deleted Mingler.
 */
export function minglerInitials(name: string | null | undefined): string {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? []
  if (words.length === 0) return '?'

  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return `${first}${last}`.toUpperCase()
}

/**
 * The big average, to one decimal (`4` → `"4.0"`).
 *
 * The server sends a number, and `4` arriving for a 4.0 average would otherwise
 * render as a bare "4" beside rows showing "4.5".
 */
export function averageLabel(average: number): string {
  return Number.isFinite(average) ? average.toFixed(1) : '0.0'
}

/**
 * How many whole stars to light for the summary block.
 *
 * The row stars use the review's own integer rating; only the average needs
 * rounding, and it is clamped so a malformed payload cannot light six stars.
 */
export function roundedStars(average: number): number {
  if (!Number.isFinite(average)) return 0
  return Math.min(5, Math.max(0, Math.round(average)))
}

/**
 * What proportion of the histogram bar to fill, as a whole percentage.
 *
 * Driven off `summary.total` — the all-time count — because the histogram
 * describes every review the restaurant has received, not the filtered page. A
 * zero total would otherwise divide by zero on the empty state.
 */
export function distributionPercent(count: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.round((count / total) * 100)
}
