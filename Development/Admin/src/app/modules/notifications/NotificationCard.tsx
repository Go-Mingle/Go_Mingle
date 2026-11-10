import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { NotificationItem } from './types'
import { notificationIcon, notificationIconBgClass } from './notificationIcon'
import { formatNotificationDateTime } from '../../../shared/utils/dateHelpers'

interface Props {
  notification: NotificationItem
  onMarkRead: (id: string) => void
  onOpen?: (notification: NotificationItem) => void
}

export function NotificationCard({ notification: n, onMarkRead, onOpen }: Props) {
  const { t } = useTranslation('notifications')
  const isRead = !!n.readAt

  const handleOpen = () => onOpen?.(n)
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleOpen()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={n.title}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      className="bg-[var(--color-card)] rounded-[var(--radius-lg)] px-4 sm:px-6 py-4 flex items-start gap-3 sm:gap-3.5 shadow-[var(--shadow-sm)] cursor-pointer text-left w-full"
      style={{
        borderLeft: isRead ? '1px solid var(--color-border)' : '3px solid var(--color-accent)',
      }}
    >
      <div
        className={`w-10 h-10 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0 ${notificationIconBgClass(
          n.type,
        )}`}
      >
        {notificationIcon(n.type)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <span
            className="text-sm text-[var(--color-text)] min-w-0 break-words"
            style={{ fontWeight: isRead ? 500 : 600 }}
          >
            {n.title}
          </span>
          <span className="text-xs text-[var(--color-text-subtle)] shrink-0 whitespace-nowrap">
            {formatNotificationDateTime(n.createdAt)}
          </span>
        </div>
        <p className="text-[13px] text-[var(--color-text-muted)] m-0 leading-[1.5] break-words">
          {n.body}
        </p>
        {!isRead && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onMarkRead(n.id)
            }}
            className="mt-2 text-xs font-medium text-[var(--color-accent)] bg-transparent border-none cursor-pointer p-0 whitespace-nowrap hover:underline"
          >
            {t('markAsRead')}
          </button>
        )}
      </div>
    </div>
  )
}
