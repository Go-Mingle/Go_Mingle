/**
 * Monetary and date display for the Finances surface.
 *
 * Amounts arrive as raw numbers — `2012`, not `"2012.00"` — so the PKR prefix
 * and thousands separators are the client's job.
 *
 * BR-13 asks for the stored precision preserved with no rounding, and its own
 * examples are `PKR 2,012` and `PKR 934.5` — i.e. trailing zeros are *not*
 * padded on. (The backend hand-off says "two decimals"; that applies to the CSV,
 * which the server already formats. Following the spec's rule and examples here.
 * Flagged for confirmation.)
 */
const PKR_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** `2012` → `PKR 2,012`; `934.5` → `PKR 934.5`; `1069.25` → `PKR 1,069.25`. */
export function formatPkr(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `PKR ${PKR_FORMAT.format(value)}`
}

/**
 * The loyalty line (BR-11): `PKR {n} ({p} pts)` when anything was redeemed, and
 * an em dash when nothing was. The row is always rendered, never hidden, and the
 * value is positive and in the default colour — not a red negative.
 */
export function formatLoyaltyDeduction(pkr: number, points: number): string {
  if (!(pkr > 0)) return '—'
  return `${formatPkr(pkr)} (${points.toLocaleString('en-US')} pts)`
}

/**
 * Dates arrive as `YYYY-MM-DD` in Asia/Karachi and are rendered exactly as
 * received (BR-09). This is deliberately not a dayjs pass-through: the rest of
 * the portal formats `DD-MM-YYYY HH:MM`, and reparsing would risk a timezone
 * shift moving a booking to the wrong day.
 */
export function formatLedgerDate(date: string | null | undefined): string {
  return date?.trim() || '—'
}
