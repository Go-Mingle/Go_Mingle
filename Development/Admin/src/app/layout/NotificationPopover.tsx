import { Popover } from 'antd'
import { Bell, Checks as CheckCheck } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { NotificationItem } from '../modules/notifications/types'
import {
  notificationIcon,
  notificationIconBgClass,
} from '../modules/notifications/notificationIcon'
import { resolveDeepLink } from '../modules/notifications/deepLink'
import { NOTIFICATIONS_MAX_PREVIEW } from '../modules/notifications/constants'
import { formatRelativeTime } from '../../shared/utils/dateHelpers'
import {
  useUnreadCountQuery,
  useRecentNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from '../modules/notifications/hooks/useNotificationsQuery'

function PopoverContent({ onViewAll, onClose }: { onViewAll: () => void; onClose: () => void }) {
  const { t } = useTranslation(['notifications', 'common'])
  const navigate = useNavigate()
  const { data: unread } = useUnreadCountQuery()
  const { data: recent } = useRecentNotificationsQuery()
  const markReadMutation = useMarkNotificationReadMutation()
  const markAllReadMutation = useMarkAllNotificationsReadMutation()
  const unreadCount = unread?.count ?? 0

  const sorted = (recent?.items ?? []).slice(0, NOTIFICATIONS_MAX_PREVIEW)

  // Clicking a row marks it read (if unread), routes to its deepLink, and closes the popover.
  const handleOpen = (n: NotificationItem) => {
    if (!n.readAt) markReadMutation.mutate(n.id)
    const target = resolveDeepLink(n)
    if (target) navigate(target)
    onClose()
  }

  return (
    <div style={{ width: 'min(380px, calc(100vw - 32px))', maxWidth: '100vw' }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3.5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[var(--color-text)]">{t('title')}</span>
          {unreadCount > 0 && (
            <span className="bg-[var(--color-coral)] text-white text-[10px] font-bold rounded-[100px] px-[7px] py-[1px]">
              {unreadCount > 99 ? '99+' : String(unreadCount)}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="flex items-center gap-1 text-xs text-[var(--color-accent)] font-medium bg-transparent border-none cursor-pointer p-0"
          >
            <CheckCheck size={13} /> {t('markAllRead')}
          </button>
        )}
      </div>

      <div className="max-h-[340px] overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 gap-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'var(--color-accent-light)' }}
            >
              <Bell size={28} className="text-[var(--color-accent)]" />
            </div>
            <span className="text-[15px] font-semibold text-[var(--color-text)]">{t('empty')}</span>
            <span className="text-xs text-[var(--color-text-muted)] text-center">
              {t('emptyHint')}
            </span>
          </div>
        ) : (
          sorted.map((n: NotificationItem) => {
            const isRead = !!n.readAt
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                aria-label={n.title}
                onClick={() => handleOpen(n)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleOpen(n)
                  }
                }}
                className="flex gap-2.5 px-4 py-3 border-b border-[var(--color-divider)] relative cursor-pointer text-left w-full"
                style={{ background: isRead ? 'transparent' : 'rgba(15,167,157,0.03)' }}
              >
                {!isRead && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--color-accent)] rounded-[0_2px_2px_0]" />
                )}
                <div
                  className={`w-9 h-9 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0 ${notificationIconBgClass(
                    n.type,
                  )}`}
                >
                  {notificationIcon(n.type, 16)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <span
                      className="text-[13px] text-[var(--color-text)] leading-[1.3]"
                      style={{ fontWeight: isRead ? 500 : 600 }}
                    >
                      {n.title}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-subtle)] shrink-0 mt-px">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </div>
                  <p
                    className="text-xs text-[var(--color-text-muted)] m-0 mt-[3px] leading-[1.4]"
                    style={{ paddingBottom: isRead ? 0 : 18 }}
                  >
                    {n.body}
                  </p>
                </div>
                {!isRead && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      markReadMutation.mutate(n.id)
                    }}
                    className="absolute bottom-2.5 right-3 text-[11px] text-[var(--color-accent)] font-medium bg-transparent border-none cursor-pointer p-0"
                  >
                    {t('common:labels.markAsRead')}
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {sorted.length > 0 && (
        <button
          onClick={onViewAll}
          className="block w-full px-4 py-3 text-center text-[13px] font-semibold text-[var(--color-accent)] bg-transparent border-none cursor-pointer border-t border-[var(--color-border)]"
        >
          {t('viewAll')}
        </button>
      )}
    </div>
  )
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onViewAll: () => void
}

export function NotificationPopover({ open, onOpenChange, onViewAll }: Props) {
  const { data: unread } = useUnreadCountQuery()
  const unreadCount = unread?.count ?? 0

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger="click"
      placement="bottomRight"
      overlayClassName="notification-popover"
      content={<PopoverContent onViewAll={onViewAll} onClose={() => onOpenChange(false)} />}
      arrow={false}
    >
      <div className="relative w-9 h-9 rounded-[8px] flex items-center justify-center cursor-pointer text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]">
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--color-coral)] text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : String(unreadCount)}
          </span>
        )}
      </div>
    </Popover>
  )
}
