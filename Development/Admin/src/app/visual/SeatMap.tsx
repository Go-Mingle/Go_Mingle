import type { ReactNode } from 'react'

interface SeatMapProps {
  /** Seats taken. */
  booked: number
  /** Seats at the table. */
  total: number
  /** Pixel size of the square drawing. */
  size?: number
  /** Read out instead of the default "6 of 8 seats booked". */
  label?: string
  /** Shown on the table top; defaults to "6/8". */
  center?: ReactNode
  /** Seats pop in one after another (used once, on the sign-in screen). */
  animate?: boolean
  className?: string
}

/** More seats than this no longer read as dots; the ring becomes a single arc. */
const MAX_DOTS = 16

/**
 * A dining table seen from above: one dot per seat around it, filled when the
 * seat is booked. This is how GoMingle shows how full a table is.
 */
export function SeatMap({
  booked,
  total,
  size = 56,
  label,
  center,
  animate,
  className,
}: Readonly<SeatMapProps>) {
  const seats = Math.max(0, Math.round(total))
  const taken = Math.max(0, Math.min(seats, Math.round(booked)))
  const c = 50
  const ring = 39
  const text = label ?? `${taken} of ${seats} seats booked`

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={text}
      className={className}
    >
      <circle
        cx={c}
        cy={c}
        r={24}
        fill="var(--color-accent-light)"
        stroke="var(--color-border)"
        strokeWidth={1.5}
      />
      {seats > MAX_DOTS || seats === 0 ? (
        <>
          <circle cx={c} cy={c} r={ring} fill="none" stroke="var(--color-border)" strokeWidth={7} />
          <circle
            cx={c}
            cy={c}
            r={ring}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * ring}
            strokeDashoffset={2 * Math.PI * ring * (1 - (seats ? taken / seats : 0))}
            transform={`rotate(-90 ${c} ${c})`}
            className="gm-ring-value"
          />
        </>
      ) : (
        Array.from({ length: seats }, (_, i) => {
          const angle = (i / seats) * Math.PI * 2 - Math.PI / 2
          const filled = i < taken
          return (
            <circle
              key={i}
              cx={c + Math.cos(angle) * ring}
              cy={c + Math.sin(angle) * ring}
              r={seats > 10 ? 5.5 : 7}
              fill={filled ? 'var(--chart-1)' : 'var(--color-card)'}
              stroke={filled ? 'var(--chart-1)' : 'var(--color-border-strong)'}
              strokeWidth={2}
              className={animate ? 'gm-seat gm-seat-in' : 'gm-seat'}
              style={
                animate ? ({ '--delay': `${200 + i * 90}ms` } as React.CSSProperties) : undefined
              }
            />
          )
        })
      )}
      {center === undefined ? (
        <text
          x={c}
          y={c}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={seats > 9 ? 13 : 15}
          fontWeight={700}
          fill="var(--color-text)"
          aria-hidden="true"
        >
          {taken}/{seats}
        </text>
      ) : (
        center
      )}
    </svg>
  )
}

interface PlateProps {
  /** A Phosphor icon, or anything, shown on the table top. */
  children: ReactNode
  size?: number
}

/**
 * The empty-state picture: an unbooked table with the section's icon on it.
 * "Nothing here yet" in GoMingle's own shape.
 */
export function TablePlate({ children, size = 96 }: Readonly<PlateProps>) {
  return (
    <span className="relative inline-flex items-center justify-center" aria-hidden="true">
      <SeatMap booked={0} total={8} size={size} label="" center={null} />
      <span className="absolute inset-0 flex items-center justify-center text-[var(--color-accent)]">
        {children}
      </span>
    </span>
  )
}
