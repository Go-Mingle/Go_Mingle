import type { ReactNode } from 'react'

interface Props {
  /** Done so far. */
  value: number
  /** Out of. */
  max: number
  size?: number
  /** Read out, e.g. "6 of 9 sections complete". */
  label: string
  /** Shown in the middle; defaults to the percentage. */
  children?: ReactNode
}

/** A ring that fills as steps are completed. */
export function ProgressRing({ value, max, size = 64, label, children }: Readonly<Props>) {
  const r = 42
  const length = 2 * Math.PI * r
  const share = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const done = share === 1
  return (
    <span className="relative inline-flex items-center justify-center shrink-0">
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label}>
        <circle cx={50} cy={50} r={r} fill="none" stroke="var(--color-border)" strokeWidth={9} />
        <circle
          cx={50}
          cy={50}
          r={r}
          fill="none"
          stroke={done ? 'var(--color-success)' : 'var(--chart-1)'}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - share)}
          transform="rotate(-90 50 50)"
          className="gm-ring-value"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-[var(--color-text)]"
        aria-hidden="true"
      >
        {children ?? `${Math.round(share * 100)}%`}
      </span>
    </span>
  )
}
