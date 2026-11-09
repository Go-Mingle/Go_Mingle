import { Check } from '@phosphor-icons/react'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'

export type StatusVariant =
  | 'active'
  | 'pending'
  | 'suspended'
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
  // Interest-table lifecycle (J6F) and invite states. Added here rather than in a
  // fourth badge component: before this, `confirmed` and `coming_soon` existed only
  // in prototype forks with off-token hex fills.
  | 'confirmed'
  | 'coming-soon'
  | 'invited'
  | 'table-booked'

interface BadgeStyle {
  /** soft background utility class */
  bg: string
  /** text colour utility class (also drives the Phosphor check via currentColor) */
  text: string
  /** dot background utility class; defaults to the text colour when omitted */
  dot?: string
  useCheck?: boolean
}

// Lifecycle/state variants — solid fill + white text, no dot (matches the
// restaurant listing status tag). Everything else is a classification tag
// rendered soft (light bg + coloured text), like the restaurant category tag.
// Full Tailwind class literals so the JIT scanner emits them.
const SOLID_STATUS: Partial<Record<StatusVariant, string>> = {
  active: 'bg-[var(--color-success)]',
  pending: 'bg-[var(--color-warning)]',
  suspended: 'bg-[var(--color-error)]',
  completed: 'bg-[var(--color-success)]',
  cancelled: 'bg-[var(--color-error)]',
  'no-show': 'bg-[var(--color-error)]',
  deactivated: 'bg-[var(--color-badge-neutral)]',
  // An interest table's lifecycle reads as a status, not a classification, so both
  // are solid like `pending` and `completed` beside them in the same column.
  confirmed: 'bg-[var(--color-info)]',
  'coming-soon': 'bg-[var(--color-navy)]',
}

const styles: Record<StatusVariant, BadgeStyle> = {
  active: { bg: 'bg-[var(--color-success-bg)]', text: 'text-[var(--color-success)]' },
  pending: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning)]' },
  suspended: { bg: 'bg-[var(--color-error-bg)]', text: 'text-[var(--color-error)]' },
  deactivated: { bg: 'bg-[var(--color-divider)]', text: 'text-[var(--color-text-muted)]' },
  completed: { bg: 'bg-[var(--color-accent-light)]', text: 'text-[var(--color-accent-dark)]' },
  'no-show': { bg: 'bg-[var(--color-error-bg)]', text: 'text-[var(--color-error)]' },
  cancelled: {
    bg: 'bg-[var(--color-divider)]',
    text: 'text-[var(--color-text-muted)]',
    dot: 'bg-[var(--color-text-subtle)]',
  },
  'partially-cancelled': {
    bg: 'bg-[var(--color-warning-bg)]',
    text: 'text-[var(--color-warning)]',
    dot: 'bg-[var(--color-warning)]',
  },
  paid: {
    bg: 'bg-[var(--color-success-bg)]',
    text: 'text-[var(--color-success)]',
    dot: 'bg-[var(--color-success)]',
  },
  upcoming: {
    bg: 'bg-[var(--color-accent-light)]',
    text: 'text-[var(--color-accent-dark)]',
    dot: 'bg-[var(--color-accent)]',
  },
  verified: {
    bg: 'bg-[var(--color-accent-light)]',
    text: 'text-[var(--color-accent-dark)]',
    useCheck: true,
  },
  flagged: {
    bg: 'bg-[var(--color-error-bg)]',
    text: 'text-[var(--color-error)]',
    dot: 'bg-[var(--color-error)]',
  },
  'super-admin': {
    bg: 'bg-[var(--color-accent-light)]',
    text: 'text-[var(--color-accent-dark)]',
    dot: 'bg-[var(--color-accent-dark)]',
  },
  commission: {
    bg: 'bg-[var(--color-accent-light)]',
    text: 'text-[var(--color-accent-dark)]',
    dot: 'bg-[var(--color-accent-dark)]',
  },
  penalty: {
    bg: 'bg-[var(--color-warning-bg)]',
    text: 'text-[var(--color-warning)]',
    dot: 'bg-[var(--color-warning)]',
  },
  confirmed: { bg: 'bg-[var(--color-info-bg)]', text: 'text-[var(--color-info)]' },
  'coming-soon': { bg: 'bg-[var(--color-divider)]', text: 'text-[var(--color-text)]' },
  // Invite states are classifications rather than lifecycle: an invite awaiting a
  // reply sits beside a booked one in the same column, so they read soft with a dot.
  invited: {
    bg: 'bg-[var(--color-warning-bg)]',
    text: 'text-[var(--color-warning)]',
    dot: 'bg-[var(--color-warning)]',
  },
  'table-booked': {
    bg: 'bg-[var(--color-success-bg)]',
    text: 'text-[var(--color-success)]',
    dot: 'bg-[var(--color-success)]',
  },
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
    active: t('status.active'),
    pending: t('status.pending'),
    suspended: t('status.suspended'),
    deactivated: t('status.deactivated'),
    completed: t('status.completed'),
    'no-show': t('status.noShow'),
    cancelled: t('status.cancelled'),
    'partially-cancelled': 'Partial Cancel',
    paid: t('status.paid'),
    upcoming: 'Upcoming',
    verified: t('status.verified'),
    flagged: t('status.flagged'),
    'super-admin': t('topbar.superAdmin'),
    commission: t('finances:types.bookingCommission'),
    penalty: t('finances:types.penalty'),
    confirmed: t('status.confirmed'),
    'coming-soon': t('status.comingSoon'),
    invited: t('status.invited'),
    'table-booked': t('status.tableBooked'),
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
          solidBg,
          'text-white',
          className,
        )}
      >
        {label}
      </span>
    )
  }

  // Classification tag — soft bg + coloured text, radius 4, dot or check.
  const dotClass = c.dot ?? c.text.replace('text-[', 'bg-[')
  return (
    <span
      className={clsx(
        'inline-flex items-center h-6 px-[10px] rounded-[4px]',
        'text-[12px] font-medium font-[var(--font-ui)] whitespace-nowrap leading-none gap-[6px]',
        c.bg,
        c.text,
        className,
      )}
    >
      {c.useCheck ? (
        <Check size={11} className="shrink-0" />
      ) : (
        <span className={clsx('w-[6px] h-[6px] rounded-full shrink-0 inline-block', dotClass)} />
      )}
      {label}
    </span>
  )
}
