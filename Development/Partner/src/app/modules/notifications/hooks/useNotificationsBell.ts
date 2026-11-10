import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import { UNREAD_BADGE_CAP } from '../constants'
import { isNotificationNotFound, notificationsErrorFallbackKey } from '../errors'
import { resolveDeepLink, unreadBadgeLabel } from '../format'
import type { NotificationItem } from '../types'
import {
  useAdoptUnreadCount,
  useMarkAllReadMutation,
  useMarkReadMutation,
  useRecentNotificationsQuery,
  useRefreshNotifications,
  useUnreadCountQuery,
} from './usePartnerNotificationsQueries'

/**
 * A toast channel. Structurally the same as J6A's `ProfileFeedback`, declared locally
 * because the bell lives in the app shell rather than on the profile page and must not
 * depend on it.
 */
export interface NotificationsFeedback {
  showError: (text: string) => void
}

/**
 * The bell and its dropdown (US-01, US-02, US-04).
 *
 * The badge polls; the panel's contents are fetched only once it opens. Read state is
 * shared across the restaurant, so another user's mark-read reaches this tab on the next
 * poll rather than immediately — expected, not a bug.
 */
export function useNotificationsBell(open: boolean, feedback: NotificationsFeedback) {
  const { t } = useTranslation(['notifications', 'common'])
  const navigate = useNavigate()

  const countQuery = useUnreadCountQuery()
  const recentQuery = useRecentNotificationsQuery(open)
  const markRead = useMarkReadMutation()
  const markAllRead = useMarkAllReadMutation()
  const adoptCount = useAdoptUnreadCount()
  const refresh = useRefreshNotifications()

  const showError = useCallback(
    (cause: unknown) => {
      feedback.showError(getApiErrorMessage(cause, t(notificationsErrorFallbackKey(cause))))
    },
    [feedback, t],
  )

  /**
   * The panel's response carries the authoritative count, so opening it is a free badge
   * refresh rather than a reason to wait out the rest of the poll interval.
   */
  const panelCount = recentQuery.data?.unreadCount
  useEffect(() => {
    if (panelCount !== undefined) adoptCount(panelCount)
    // `adoptCount` is a stable closure over the query client; re-running on its identity
    // would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelCount])

  /**
   * A stale row the server no longer has. The list is re-read so it disappears, and the
   * partner is told once — rather than leaving a row that fails every time it is clicked.
   */
  const handleWriteError = useCallback(
    (cause: unknown) => {
      if (isNotificationNotFound(cause)) {
        feedback.showError(t('notifications:errors.notFound'))
        refresh()
        return
      }
      showError(cause)
    },
    [feedback, refresh, showError, t],
  )

  /**
   * Clicking the row body: mark read **and** navigate (BR-10, AC-04.1).
   *
   * The mark and the navigation are independent on purpose. Navigation does not wait for
   * the write — the partner asked to go somewhere, and holding them on a spinner for a
   * bookkeeping call would be worse than the write landing a moment later. A row with no
   * resolvable destination still marks read and simply stays put (AC-04.4).
   */
  const openNotification = useCallback(
    (item: NotificationItem) => {
      if (!item.isRead) {
        markRead.mutate(item.id, { onError: handleWriteError })
      }

      const target = resolveDeepLink(item.deepLink)
      if (target) void navigate(target)
    },
    [markRead, handleWriteError, navigate],
  )

  /** The explicit link: mark read, stay put (AC-04.5). */
  const markOneRead = useCallback(
    (id: string) => {
      markRead.mutate(id, { onError: handleWriteError })
    },
    [markRead, handleWriteError],
  )

  const markEverythingRead = useCallback(() => {
    markAllRead.mutate(undefined, { onError: showError })
  }, [markAllRead, showError])

  const unreadCount = countQuery.data?.unreadCount ?? 0

  return {
    /** `null` when there is nothing to show — the badge is removed, not zeroed (BR-06). */
    badgeLabel: unreadBadgeLabel(unreadCount, UNREAD_BADGE_CAP),
    unreadCount,

    items: recentQuery.data?.items ?? [],
    isPending: recentQuery.isPending,
    isError: recentQuery.isError,
    error: recentQuery.error,

    /**
     * Drives every read affordance on the panel (BR-09). When false the count chip, the
     * per-row links and "Mark all as read" are **removed**, not disabled.
     */
    hasUnread: unreadCount > 0,

    openNotification,
    markOneRead,
    markEverythingRead,
    markingAll: markAllRead.isPending,
  }
}

export type NotificationsBellController = ReturnType<typeof useNotificationsBell>
