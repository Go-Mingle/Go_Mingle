import type { CSSProperties } from 'react'

interface GoMingleLogoProps {
  collapsed?: boolean
  /** Height of the logo (default 36px); the mark alone is drawn 4px taller. */
  height?: number
  /** Light lockup for dark backgrounds (whatever the app theme is). */
  light?: boolean
  /** Draw the table and seat the guests once, on mount. Off under reduced motion. */
  animated?: boolean
}

/**
 * Seats around the table, clockwise from the top. The last one is the open
 * seat: tables come in every size, so the mark never counts heads, it shows a
 * place still waiting for someone.
 */
const SEATS = [
  { cx: 32, cy: 7, warm: true },
  { cx: 53.7, cy: 19.5, warm: false },
  { cx: 53.7, cy: 44.5, warm: true },
  { cx: 32, cy: 57, warm: false },
  { cx: 10.3, cy: 44.5, warm: true },
] as const
const OPEN_SEAT = { cx: 10.3, cy: 19.5 }

/** The GoMingle mark: the O is a round table with guests and one open seat. */
export function GoMingleMark({
  size = 36,
  light = false,
  animated = false,
}: {
  size?: number
  light?: boolean
  animated?: boolean
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={`gm-mark${light ? ' gm-mark--light' : ''}${animated ? ' gm-mark--animated' : ''}`}
    >
      <circle
        className="gm-mark__table"
        cx="32"
        cy="32"
        r="14"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
      />
      {SEATS.map((s, i) => (
        <circle
          key={i}
          className={`gm-mark__seat ${s.warm ? 'gm-mark__seat--warm' : 'gm-mark__seat--cool'}`}
          style={{ '--seat-i': i } as CSSProperties}
          cx={s.cx}
          cy={s.cy}
          r="4.6"
        />
      ))}
      <circle
        className="gm-mark__open"
        cx={OPEN_SEAT.cx}
        cy={OPEN_SEAT.cy}
        r="3.8"
        fill="none"
        strokeWidth="2"
      />
    </svg>
  )
}

export function GoMingleLogo({
  collapsed = false,
  height = 36,
  light = false,
  animated = false,
}: GoMingleLogoProps) {
  if (collapsed) {
    return (
      <span role="img" aria-label="GoMingle" className="gm-logo inline-flex">
        <GoMingleMark size={height + 4} light={light} animated={animated} />
      </span>
    )
  }
  return (
    <span
      role="img"
      aria-label="GoMingle"
      className={`gm-logo gm-wordmark inline-flex items-center${light ? ' gm-wordmark--light' : ''}`}
      style={{ '--logo-h': `${height}px` } as CSSProperties}
    >
      <span aria-hidden="true">G</span>
      <GoMingleMark size={Math.round(height * 0.86)} light={light} animated={animated} />
      <span aria-hidden="true">Mingle</span>
    </span>
  )
}
