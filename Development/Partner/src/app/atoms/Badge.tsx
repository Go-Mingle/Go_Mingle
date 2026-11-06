import { Tag } from 'antd'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'

export type BadgeVariant =
  | 'active'
  | 'pending'
  | 'inactive'
  | 'suspended'
  | 'flagged'
  | 'verified'
  | 'mingle-friendly'

interface BadgeProps {
  variant: BadgeVariant
  className?: string
}

// Full Tailwind class literals per variant so the JIT scanner picks them up.
const variantClasses: Record<BadgeVariant, string> = {
  active: 'text-[var(--color-success)] bg-[var(--color-success-bg)]',
  pending: 'text-[var(--color-warning)] bg-[var(--color-warning-bg)]',
  inactive: 'text-[var(--color-text-muted)] bg-[var(--color-page)]',
  suspended: 'text-[var(--color-error)] bg-[var(--color-error-bg)]',
  flagged: 'text-[var(--color-error)] bg-[var(--color-error-bg)]',
  verified: 'text-[var(--color-accent-dark)] bg-[var(--color-teal-light)]',
  'mingle-friendly': 'text-[var(--color-info)] bg-[var(--color-info-bg)]',
}

const labelKeys: Record<BadgeVariant, string> = {
  active: 'status.active',
  pending: 'status.pending',
  inactive: 'status.inactive',
  suspended: 'status.suspended',
  flagged: 'status.flagged',
  verified: 'status.verified',
  'mingle-friendly': 'status.mingleFriendly',
}

export function Badge({ variant, className }: BadgeProps) {
  const { t } = useTranslation('common')
  return (
    <Tag
      bordered={false}
      className={clsx(
        'font-[var(--font-ui)] uppercase tracking-[0.08em] font-semibold',
        'text-[11px] leading-[1.4] rounded-[4px]',
        variantClasses[variant],
        className,
      )}
    >
      {t(labelKeys[variant])}
    </Tag>
  )
}
