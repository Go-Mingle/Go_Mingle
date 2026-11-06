import { Alert, Popover, Spin, message } from 'antd'
import { clsx } from 'clsx'
import { Bell, Checks as CheckCheck } from '@phosphor-icons/react'
import type { TFunction } from 'i18next'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../shared/utils/apiError'
import { CountBadge } from '../atoms/CountBadge'
import { NotificationTimestamp } from '../modules/notifications/components/NotificationTimestamp'
import { UNREAD_BADGE_CAP } from '../modules/notifications/constants'
import { useNotificationsBell } from '../modules/notifications/hooks/useNotificationsBell'
import type { NotificationsBellController } from '../modules/notifications/hooks/useNotificationsBell'
import { notifIcon, notifIconBgClass } from '../modules/notifications/notificationMeta'
import type { NotificationItem } from '../modules/notifications/types'

interface NotificationRowProps {
  n: NotificationItem
  onOpen: (n: NotificationItem) => void
  onMarkRead: (id: string) => void
  t: TFunction
}

/**
 * One row of the dropdown.
 *
 * Read affordances are **absent** rather than disabled when the row is read (BR-09): no
 * dot, no "Mark as read" link, a regular-weight title and no tint. That is the design's
 * all-read variant, not a styling shortcut.
 */
function NotificationRow({ n, onOpen, onMarkRead, t }: NotificationRowProps) {
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
        'flex cursor-pointer gap-2.5 border-b border-[var(--color-divider)] px-4 py-3 md:hover:bg-[var(--color-hover)]',
        n.isRead ? 'bg-transparent' : 'bg-[rgba(15,167,157,0.04)]',
      )}
    >
      {/* The tint is a Tailwind class now rather than an inline custom property — an
          unknown type resolves to a neutral one instead of throwing. */}
      <div
        className={clsx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)]',
          notifIconBgClass(n.type),
        )}
      >
        {notifIcon(n.type)}
      </div>

      <div className="min-w-0 flex-1">
        <span
          className={clsx(
            'flex items-center gap-1.5 text-xs leading-[1.3] text-[var(--color-text)] md:text-[13px]',
            n.isRead ? 'font-medium' : 'font-semibold',
          )}
        >
          {!n.isRead && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]"
              aria-hidden
            />
          )}
          {/* Stored at event time and frozen — rendered verbatim, never recomposed. */}
          {n.title}
        </span>
        <p className="m-0 mt-[3px] text-xs leading-[1.4] text-[var(--color-text-muted)]">
          {n.body}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <NotificationTimestamp
            createdAt={n.createdAt}
            className="text-[11px] text-[var(--color-text-subtle)]"
          />
          {!n.isRead && (
            <button
              type="button"
              onClick={(e) => {
                // Without this the row's own handler fires too and the partner is
                // navigated away by a link that is supposed to keep them here (AC-04.5).
                e.stopPropagation()
                onMarkRead(n.id)
              }}
              className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-[11px] font-medium text-[var(--color-accent)]"
            >
              {t('notifications:markAsRead')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PopoverContent({
  c,
  onViewAll,
  onClose,
}: {
  c: NotificationsBellController
  onViewAll: () => void
  onClose: () => void
}) {
  const { t } = useTranslation(['notifications', 'common'])

  const openNotification = useCallback(
    (n: NotificationItem) => {
      onClose()
      c.openNotification(n)
    },
    [c, onClose],
  )

  return (
    <div className="w-[min(360px,calc(100vw_-_90px))] max-w-full">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[var(--color-text)]">
            {t('notifications:title')}
          </span>
          {/* Absent at zero, not a "0" (BR-09). */}
          <CountBadge count={c.unreadCount} cap={UNREAD_BADGE_CAP} />
        </div>
        {/* Removed entirely when everything is read, not greyed out (BR-09). */}
        {c.hasUnread && (
          <button
            type="button"
            onClick={c.markEverythingRead}
            disabled={c.markingAll}
            className="flex shrink-0 cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-xs font-medium text-[var(--color-accent)] disabled:opacity-50"
          >
            <CheckCheck size={13} /> {t('notifications:markAllRead')}
          </button>
        )}
      </div>

      <div className="max-h-[340px] overflow-y-auto">
        {c.isPending && (
          <div className="flex justify-center py-10">
            <Spin />
          </div>
        )}

        {c.isError && (
          <div className="p-4">
            <Alert
              type="error"
              message={getApiErrorMessage(c.error, t('notifications:loadError'))}
            />
          </div>
        )}

        {!c.isPending && !c.isError && c.items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent-light)]">
              <Bell size={22} className="text-[var(--color-accent)]" />
            </div>
            <span className="text-[13px] font-semibold text-[var(--color-text)]">
              {t('notifications:empty')}
            </span>
            <span className="text-center text-xs text-[var(--color-text-muted)]">
              {t('notifications:emptyHint')}
            </span>
          </div>
        )}

        {!c.isPending &&
          !c.isError &&
          c.items.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              onOpen={openNotification}
              onMarkRead={c.markOneRead}
              t={t}
            />
          ))}
      </div>

      {/* Always present (BR-07). The prototype hid it on an empty inbox, which left a
          partner with no way through to the full history from here. */}
      <button
        type="button"
        onClick={onViewAll}
        className="block w-full cursor-pointer border-none border-t border-[var(--color-border)] bg-transparent px-4 py-3 text-center text-[13px] font-semibold text-[var(--color-accent)]"
      >
        {t('notifications:viewAll')}
      </button>
    </div>
  )
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onViewAll: () => void
}

/**
 * The header bell, its badge and the dropdown (J7 US-01, US-02, US-04).
 *
 * Its own toast channel rather than the profile page's: the bell lives in the app shell,
 * reachable from every route, so it cannot depend on a page-level provider.
 */
export function NotificationPopover({ open, onOpenChange, onViewAll }: Props) {
  const { t } = useTranslation('notifications')
  const [messageApi, contextHolder] = message.useMessage()

  const showError = useCallback(
    (text: string) => {
      void messageApi.error(text)
    },
    [messageApi],
  )

  const c = useNotificationsBell(open, { showError })

  return (
    <>
      {contextHolder}
      <Popover
        open={open}
        onOpenChange={onOpenChange}
        trigger="click"
        placement="bottomRight"
        overlayClassName="notification-popover"
        overlayStyle={{ maxWidth: 'calc(100vw - 16px)' }}
        content={<PopoverContent c={c} onViewAll={onViewAll} onClose={() => onOpenChange(false)} />}
        arrow={false}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={
            c.unreadCount > 0 ? t('bellAria', { count: c.unreadCount }) : t('bellAriaNone')
          }
          aria-haspopup="dialog"
          aria-expanded={open}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onOpenChange(!open)
            }
          }}
          className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[8px] text-[var(--color-text-muted)] md:hover:bg-[var(--color-hover)]"
        >
          <Bell size={18} />
          {/* Renders nothing at zero, leaving a bell outline (BR-06). */}
          <CountBadge count={c.unreadCount} cap={UNREAD_BADGE_CAP} placement="overlay" />
        </div>
      </Popover>
    </>
  )
}
