import './MinglerStatusBadge.css'

// Matches the restaurant listing status tag: solid fill + white text, radius 4.
const MINGLER_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'var(--color-success)',
  SUSPENDED: 'var(--color-error)',
  PENDING: 'var(--color-text-secondary)',
  DELETED: 'var(--color-text-secondary)',
}

const MINGLER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  PENDING: 'Pending',
  DELETED: 'Deleted',
}

interface MinglerStatusBadgeProps {
  status: string
}

export function MinglerStatusBadge({ status }: MinglerStatusBadgeProps) {
  const s = String(status).toUpperCase()
  const bg = MINGLER_STATUS_COLORS[s] ?? 'var(--color-text-secondary)'
  const label = MINGLER_STATUS_LABELS[s] ?? s
  return (
    <span className="mingler-status-badge" style={{ '--status-bg': bg } as React.CSSProperties}>
      {label}
    </span>
  )
}
