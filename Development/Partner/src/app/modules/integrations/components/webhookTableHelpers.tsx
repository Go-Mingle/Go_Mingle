import { Funnel } from '@phosphor-icons/react'

/**
 * The deliveries log resolves everything server-side and the API offers exactly
 * one filter — status — so this module needs only the funnel indicator. The sort
 * and search-column helpers that used to live here went with the client-side
 * sorting they supported.
 *
 * Takes its accessible name from the caller: a bare Phosphor SVG in a header cell
 * renders nameless, so assistive tech — and any test or reviewer scanning for
 * controls — cannot tell the column is filterable. The visible toolbar control is
 * the primary affordance; this stays the secondary one.
 */
export const funnelIcon = (filtered: boolean, label: string) => (
  <Funnel
    size={14}
    weight={filtered ? 'fill' : 'regular'}
    role="img"
    aria-label={label}
    className={filtered ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-subtle)]'}
  />
)
