import { Tooltip } from 'antd'
import {
  CalendarDots,
  CheckCircle,
  HourglassMedium,
  PencilSimple,
  Sparkle,
  XCircle,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { useChangePulse } from './motion'

export type LifecycleStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'COMING_SOON'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'

interface Look {
  icon: Icon
  /** Tinted fill, border and text. Full class names so Tailwind emits them. */
  tone: string
  /** A live status carries a small beating dot instead of an icon. */
  live?: boolean
}

const LOOKS: Record<LifecycleStatus, Look> = {
  DRAFT: {
    icon: PencilSimple,
    tone: 'bg-[var(--tint-neutral-bg)] border-[var(--color-border-strong)] text-[var(--color-text-secondary)]',
  },
  PENDING: {
    icon: HourglassMedium,
    tone: 'bg-[var(--color-warning-bg)] border-[var(--color-warning-border)] text-[var(--color-warning)]',
  },
  COMING_SOON: {
    icon: CalendarDots,
    tone: 'bg-[var(--tint-violet-bg)] border-[var(--tint-violet-fg)]/25 text-[var(--tint-violet-fg)]',
  },
  CONFIRMED: {
    icon: Sparkle,
    tone: 'bg-[var(--color-accent-light)] border-[var(--color-accent-mid)] text-[var(--color-accent-dark)]',
    live: true,
  },
  COMPLETED: {
    icon: CheckCircle,
    tone: 'bg-[var(--color-success-bg)] border-[var(--color-success-border)] text-[var(--color-success)]',
  },
  CANCELLED: {
    icon: XCircle,
    tone: 'bg-[var(--color-error-bg)] border-[var(--color-error-border)] text-[var(--color-error)]',
  },
}

interface Props {
  status: string
  /** What the status belongs to; picks the explanation shown on hover. */
  kind?: 'table' | 'booking'
  className?: string
}

/**
 * Where an interest table or a booking is in its life: a tinted pill with an
 * icon, one colour per stage (waiting amber, going ahead teal with a live dot,
 * done green, cancelled red). Hover or focus explains the stage in a sentence,
 * and the pill pulses once when the status changes.
 */
export function LifecycleBadge({ status, kind = 'table', className }: Readonly<Props>) {
  const { t } = useTranslation('common')
  const key = (status in LOOKS ? status : 'DRAFT') as LifecycleStatus
  const look = LOOKS[key]
  const Glyph = look.icon
  const pulse = useChangePulse(status)
  const name = key.toLowerCase()
  return (
    <Tooltip title={t(`lifecycle.${kind}.${name}`)} mouseEnterDelay={0.25}>
      <span
        tabIndex={0}
        data-status={key}
        className={clsx(
          'gm-lifecycle inline-flex items-center gap-1.5 h-[26px] pl-2 pr-2.5 rounded-[var(--radius-pill)] border',
          'text-[12px] font-semibold font-[var(--font-ui)] whitespace-nowrap leading-none cursor-default',
          'transition-shadow duration-200 hover:shadow-[var(--shadow-sm)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
          look.tone,
          pulse,
          className,
        )}
      >
        {look.live ? (
          <span className="relative flex w-2 h-2 mx-0.5" aria-hidden="true">
            <span className="gm-live-dot absolute inline-flex w-full h-full rounded-full bg-current opacity-60" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-current" />
          </span>
        ) : (
          <Glyph size={14} weight="fill" aria-hidden="true" />
        )}
        {t(`lifecycle.name.${name}`)}
      </span>
    </Tooltip>
  )
}
