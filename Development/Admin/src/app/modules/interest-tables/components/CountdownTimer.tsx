import { useTranslation } from 'react-i18next'
import { ClockCountdown } from '@phosphor-icons/react'
import type { InterestTableStatus } from '../types'

interface CountdownTimerProps {
  timeLeft: string | null
  status: InterestTableStatus
  size?: 'sm' | 'md'
}

export function CountdownTimer({ timeLeft, status, size = 'md' }: CountdownTimerProps) {
  const { t } = useTranslation('interest-tables')
  const fontSize = size === 'sm' ? 12 : 13
  const active = status === 'PENDING' || status === 'CONFIRMED'

  // No live window for ended tables (completed / cancelled).
  if (!active || !timeLeft) {
    return (
      <span
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--color-text-muted)',
        }}
      >
        —
      </span>
    )
  }

  const closed = timeLeft === 'Started' || timeLeft === 'Completed' || timeLeft === 'Cancelled'
  const color = closed ? 'var(--color-error)' : 'var(--color-text-secondary)'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'Poppins, sans-serif',
        fontSize,
        fontWeight: 600,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      <ClockCountdown size={size === 'sm' ? 13 : 15} weight="regular" />
      {closed ? t('timer.closed') : timeLeft}
    </span>
  )
}
