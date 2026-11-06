import { Check } from '@phosphor-icons/react'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'

export type StatusVariant =
  | 'ACTIVE'
  | 'PENDING'
  | 'SUSPENDED'
  | 'deactivated'
  | 'no-show'
  | 'completed'
  | 'cancelled'
  | 'partially-cancelled'
  | 'upcoming'
  | 'paid'
  | 'verified'
  | 'flagged'
  | 'super-admin'
  | 'commission'
  | 'penalty'

interface BadgeStyle {
  bg: string
  color: string
  dotColor?: string
  useCheck?: boolean
}

// Lifecycle/state variants — solid fill + white text, no dot (matches the
// restaurant listing status tag). Everything else is a classification tag
// rendered soft (light bg + coloured text), like the restaurant category tag.
const SOLID_STATUS: Partial<Record<StatusVariant, string>> = {
  ACTIVE: 'var(--color-success)',
  PENDING: 'var(--color-warning)',
  SUSPENDED: 'var(--color-error)',
  completed: 'var(--color-success)',
  cancelled: 'var(--color-error)',
  'no-show': 'var(--color-error)',
  deactivated: 'var(--color-text-secondary)',
}

const styles: Record<StatusVariant, BadgeStyle> = {
  ACTIVE: { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  PENDING: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  SUSPENDED: { bg: 'var(--color-error-bg)', color: 'var(--color-error)' },
  deactivated: { bg: 'var(--color-divider)', color: 'var(--color-text-muted)' },
  completed: { bg: 'var(--color-accent-light)', color: 'var(--color-accent-dark)' },
  'no-show': { bg: 'var(--color-error-bg)', color: 'var(--color-error)' },
  cancelled: {
    bg: 'var(--color-divider)',
    color: 'var(--color-text-muted)',
    dotColor: 'var(--color-text-subtle)',
  },
  'partially-cancelled': { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  paid: { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  upcoming: {
    bg: 'var(--color-accent-light)',
    color: 'var(--color-accent-dark)',
    dotColor: 'var(--color-accent)',
  },
  verified: { bg: 'var(--color-accent-light)', color: 'var(--color-accent-dark)', useCheck: true },
  flagged: { bg: 'var(--color-error-bg)', color: 'var(--color-error)' },
  'super-admin': { bg: 'var(--color-accent-light)', color: 'var(--color-accent-dark)' },
  commission: { bg: 'var(--color-accent-light)', color: 'var(--color-accent-dark)' },
  penalty: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
}

interface StatusBadgeProps {
  variant: StatusVariant
  className?: string
}

export function StatusBadge({ variant, className }: StatusBadgeProps) {
  const { t } = useTranslation(['common', 'finances', 'restaurants'])
  const c = styles[variant]
  if (!c) return null

  const labelMap: Record<StatusVariant, string> = {
    ACTIVE: t('status.active'),
    PENDING: t('status.pending'),
    SUSPENDED: t('status.suspended'),
    deactivated: t('status.deactivated'),
    completed: t('status.completed'),
    'no-show': t('status.noShow'),
    cancelled: t('status.cancelled'),
    'partially-cancelled': t('status.partialCancel'),
    paid: t('status.paid'),
    upcoming: t('status.upcoming'),
    verified: t('status.verified'),
    flagged: t('status.flagged'),
    'super-admin': t('topbar.superAdmin'),
    commission: t('finances:types.bookingCommission'),
    penalty: t('finances:types.penalty'),
  }

  const label = labelMap[variant]
  const solidBg = SOLID_STATUS[variant]

  // Solid status tag — solid fill, white text, radius 4, no dot.
  if (solidBg) {
    return (
      <span
        className={clsx(
          'inline-flex items-center h-6 px-[10px] rounded-[4px]',
          'text-[12px] font-semibold font-[var(--font-ui)] whitespace-nowrap leading-none',
          className,
        )}
        style={{ background: solidBg, color: '#ffffff' }}
      >
        {label}
      </span>
    )
  }

  // Classification tag — soft bg + coloured text, radius 4, dot or check.
  const dotColor = c.dotColor ?? c.color
  return (
    <span
      className={clsx(
        'inline-flex items-center h-6 px-[10px] rounded-[4px]',
        'text-[12px] font-medium font-[var(--font-ui)] whitespace-nowrap leading-none gap-[6px]',
        className,
      )}
      style={{ background: c.bg, color: c.color }}
    >
      {c.useCheck ? (
        <Check size={11} className="shrink-0" style={{ color: c.color }} />
      ) : (
        <span
          className="w-[6px] h-[6px] rounded-full shrink-0 inline-block"
          style={{ backgroundColor: dotColor }}
        />
      )}
      {label}
    </span>
  )
}
