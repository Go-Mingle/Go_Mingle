import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { NotificationTimestamp } from './components/NotificationTimestamp'
import { notifIcon, notifIconBgClass } from './notificationMeta'
import type { NotificationItem } from './types'

interface Props {
  notification: NotificationItem
  /** Row body: mark read **and** navigate (BR-10). */
  onOpen: (notification: NotificationItem) => void
  /** The explicit link: mark read, stay put (AC-04.5). */
  onMarkRead: (id: string) => void
}

/**
 * One row of the full Notifications screen.
 *
 * Read affordances are **absent** on a read row rather than disabled (BR-09): no dot, no
 * link, a regular-weight title and no tint. Navigation lives in the controller, so this
 * row and the dropdown's behave identically.
 */
export function NotificationCard({ notification: n, onOpen, onMarkRead }: Props) {
  const { t } = useTranslation('notifications')

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(n)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(n)
        }
      }}
      className={clsx(
        'notif-row flex cursor-pointer items-start gap-3 px-4 py-4 sm:gap-3.5 sm:px-6',
        n.isRead ? 'bg-transparent' : 'bg-[rgba(15,167,157,0.04)]',
      )}
    >
      {/* A Tailwind class rather than an inline custom property, and an unknown type
          resolves to a neutral tint instead of throwing. */}
      <div
        className={clsx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)]',
          notifIconBgClass(n.type),
        )}
      >
        {notifIcon(n.type, 18)}
      </div>

      <div className="min-w-0 flex-1">
        <span
          className={clsx(
            'flex min-w-0 items-center gap-2 break-words text-xs text-[var(--color-text)] md:text-sm',
            n.isRead ? 'font-medium' : 'font-semibold',
          )}
        >
          {!n.isRead && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]"
              aria-hidden
            />
          )}
          {/* Frozen at event time — rendered verbatim, never recomposed from metadata. */}
          {n.title}
        </span>
        <p className="m-0 mt-1 break-words text-xs leading-[1.5] text-[var(--color-text-muted)] md:text-[13px]">
          {n.body}
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          {/* The same ladder as the dropdown. The prototype showed an absolute date here
              and a relative one there, so one notification read two different ways. */}
          <NotificationTimestamp
            createdAt={n.createdAt}
            className="whitespace-nowrap text-[11px] text-[var(--color-text-subtle)] md:text-xs"
          />
          {!n.isRead && (
            <button
              type="button"
              onClick={(e) => {
                // Without this the row's handler fires too and navigates away, which is
                // precisely what this link must not do.
                e.stopPropagation()
                onMarkRead(n.id)
              }}
              className="shrink-0 cursor-pointer whitespace-nowrap border-none bg-transparent p-0 text-xs font-medium text-[var(--color-accent)] md:hover:underline"
            >
              {t('markAsRead')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
