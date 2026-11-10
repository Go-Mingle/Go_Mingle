import { useTranslation } from 'react-i18next'
import { INTEREST_TABLE_STATUS_COLORS } from '../constants'
import type { InterestTableStatus } from '../types'

interface InterestTableStatusBadgeProps {
  status: InterestTableStatus
}

// Solid fill + white text, radius 4 — consistent with the restaurant listing.
export function InterestTableStatusBadge({ status }: InterestTableStatusBadgeProps) {
  const { t } = useTranslation('interest-tables')
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        padding: '0 10px',
        borderRadius: 4,
        background: INTEREST_TABLE_STATUS_COLORS[status] ?? 'var(--color-text-secondary)',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'Poppins, sans-serif',
        whiteSpace: 'nowrap',
      }}
    >
      {t(`status.${status.toLowerCase()}`)}
    </span>
  )
}
