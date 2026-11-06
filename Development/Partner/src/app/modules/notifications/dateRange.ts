import dayjs from 'dayjs'
import type { DateRangeValue } from './components/NotificationsFilters'

/**
 * The two halves of the date-range round-trip between the controller and the picker.
 *
 * They live here rather than inline in the page for one reason: the endpoint's both-or-
 * neither rule is the difference between a working filter and a 400, and testing it through
 * AntD's RangePicker means typing into two inputs and clicking a clear icon that only exists
 * on hover — which is slow and flaky. Pure functions make the rule assertable directly.
 */

/** ISO strings from the controller → the dayjs pair the picker renders. */
export function toRangeValue(startDate: string | null, endDate: string | null): DateRangeValue {
  if (!startDate || !endDate) return null
  return [dayjs(startDate), dayjs(endDate)]
}

/**
 * What the picker just reported, in the three shapes the caller has to distinguish.
 *
 *   `{ from, to }` — a complete range: apply it.
 *   `null`         — cleared: drop both ends.
 *   `undefined`    — half a range: do nothing, because sending one date alone is
 *                    `ERR_DATE_RANGE_INCOMPLETE`.
 *
 * The third case is why this is not simply "apply whatever arrived". AntD emits an onChange
 * as soon as the first date is picked, and forwarding that would 400 mid-interaction.
 */
export function pickedRange(
  value: DateRangeValue,
): { from: string; to: string } | null | undefined {
  const from = value?.[0]?.format('YYYY-MM-DD') ?? null
  const to = value?.[1]?.format('YYYY-MM-DD') ?? null

  if (from && to) return { from, to }
  if (!from && !to) return null
  return undefined
}

/**
 * Routes a picker change to the controller, or drops it.
 *
 * The three-way decision lives here rather than in the page's JSX so it is one call site with
 * no branches to leave half-covered — the "cleared" arm is only reachable through AntD's
 * hover-only clear icon, which is not something to build a test around.
 */
export function applyPickedRange(
  value: DateRangeValue,
  apply: (from: string | null, to: string | null) => void,
): void {
  const picked = pickedRange(value)

  if (picked) apply(picked.from, picked.to)
  // Explicitly `=== null`: `undefined` means half a range, which must leave the filter alone.
  else if (picked === null) apply(null, null)
}
