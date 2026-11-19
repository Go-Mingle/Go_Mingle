import type { CSSProperties } from 'react'

const SEATS = [
  { cx: 32, cy: 7 },
  { cx: 53.7, cy: 19.5 },
  { cx: 53.7, cy: 44.5 },
  { cx: 32, cy: 57 },
  { cx: 10.3, cy: 44.5 },
  { cx: 10.3, cy: 19.5 },
]

interface TableLoaderProps {
  /** What a screen reader hears; also shown under the table unless `quiet`. */
  label?: string
  size?: number
  /** Hide the visible label (e.g. inside a button or spinner slot). */
  quiet?: boolean
}

/**
 * The GoMingle loader (GM-338): guests take their seats around the table one by
 * one, then the table clears and fills again. Under reduced motion it shows a
 * full table and the label.
 */
export function TableLoader({ label = 'Loading', size = 48, quiet = false }: TableLoaderProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="gm-table-loader inline-flex flex-col items-center gap-3"
    >
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="gm-mark">
        <circle className="gm-mark__table" cx="32" cy="32" r="14" fill="none" strokeWidth="5" />
        {SEATS.map((s, i) => (
          <circle
            key={i}
            className={`gm-loader-seat ${i % 2 ? 'gm-mark__seat--cool' : 'gm-mark__seat--warm'}`}
            style={{ '--seat-i': i } as CSSProperties}
            cx={s.cx}
            cy={s.cy}
            r="4.6"
          />
        ))}
      </svg>
      <span className={quiet ? 'sr-only' : 'text-[13px] font-medium text-(--color-text-muted)'}>
        {label}
      </span>
    </span>
  )
}
