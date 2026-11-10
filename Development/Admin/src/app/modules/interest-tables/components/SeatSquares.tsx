interface SeatSquaresProps {
  booked: number
  total: number
}

// [MET-1400] Was 6 — the V7 seat maximum. V8 allows Max Guests 4–8, so a
// 7- or 8-seat table silently lost its last squares (and could render as
// "full" at 6/8). Matches the top of GUEST_OPTIONS in CreateInterestTableModal.
const MAX_SQUARES = 8

/** Seat-occupancy visual: one coral square per seat (capped at 8), filled for booked seats. */
export function SeatSquares({ booked, total }: SeatSquaresProps) {
  const count = Math.min(total, MAX_SQUARES)
  const filled = Math.min(booked, count)
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: i < filled ? 'var(--color-coral)' : 'transparent',
            border: `1px solid ${i < filled ? 'var(--color-coral)' : 'var(--color-border-strong)'}`,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}
