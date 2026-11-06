import { ProminglerBadge } from '../../../../molecules/ProminglerBadge'
import { prominglerBadge } from '../format'
import type { ProminglerRef } from '../types'

/**
 * A table's Pro Mingler, for the grid and its mobile cards.
 *
 * `kind` alone decides the indicator. The prototype re-derived it from three
 * overlapping booleans — `isPromingler`, `isCaptain`, and an id comparison against
 * the table's Promingler — which is exactly the ambiguity the contract's single field
 * removes.
 *
 * Its own file so the columns factory stays a module of pure functions (the
 * `react-refresh` rule will not have components and helpers sharing a file).
 */
export function ProminglerCell({ proMingler }: { proMingler: ProminglerRef }) {
  const badge = prominglerBadge(proMingler.kind)

  if (!badge.show) {
    return <span className="text-[13px] text-[var(--color-text-subtle)]">—</span>
  }

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="text-[13px] text-[var(--color-text-secondary)]">{proMingler.name}</span>
      <ProminglerBadge verified={badge.verified} label={false} />
    </span>
  )
}
