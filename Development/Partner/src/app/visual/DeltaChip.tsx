import { ArrowDownRight, ArrowUpRight, Minus } from '@phosphor-icons/react'
import { clsx } from 'clsx'

interface Props {
  value: number
  previous: number
  /** e.g. "vs the 30 days before". */
  against: string
}

/**
 * How a figure moved against the period before it: an arrow, the change in
 * percent, and what it is compared with. "New" when there was nothing before.
 */
export function DeltaChip({ value, previous, against }: Readonly<Props>) {
  if (value === 0 && previous === 0) {
    return <span className="text-[12px] text-[var(--color-text-muted)]">No activity yet</span>
  }
  const isNew = previous === 0
  const pct = isNew ? 0 : Math.round(((value - previous) / previous) * 100)
  const dir = isNew || pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'
  const Arrow = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : Minus
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]">
      <span
        className={clsx(
          'inline-flex items-center gap-0.5 font-semibold',
          dir === 'up' && 'text-[var(--color-success)]',
          dir === 'down' && 'text-[var(--color-error)]',
        )}
      >
        <Arrow size={13} weight="bold" aria-hidden="true" />
        {isNew ? 'New' : `${pct > 0 ? '+' : ''}${pct}%`}
      </span>
      {against}
    </span>
  )
}
