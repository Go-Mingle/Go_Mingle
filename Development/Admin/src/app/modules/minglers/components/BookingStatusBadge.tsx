import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS } from './utils'

// Solid fill + white text, radius 4 — consistent with the restaurant listing.
export function BookingStatusBadge({ status }: { status: string }) {
  const s = String(status).toLowerCase()
  const bg = BOOKING_STATUS_COLORS[s] ?? 'var(--color-text-secondary)'
  const label = BOOKING_STATUS_LABELS[s] ?? s
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        padding: '0 10px',
        borderRadius: 4,
        background: bg,
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
