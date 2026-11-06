import { httpClient } from '../../../shared/api/httpClient'
import { NOTIFICATION_ENDPOINTS } from './constants'
import { buildNotificationsQuery, sanitiseNotificationsParams } from './params'
import type {
  MarkAllReadResult,
  MarkReadResult,
  NotificationTypeCatalogue,
  NotificationsPage,
  NotificationsParams,
  RecentNotifications,
  UnreadCount,
} from './types'

export const notificationsService = {
  /**
   * The bell badge (US-01).
   *
   * The hot endpoint: polled on a timer by every open tab of every user of the
   * restaurant. No personalisation — read state is shared, so everyone on the team
   * gets the same number.
   */
  getUnreadCount: (): Promise<UnreadCount> =>
    httpClient.get<UnreadCount>(NOTIFICATION_ENDPOINTS.unreadCount),

  /**
   * The dropdown panel (US-02) — the newest 7, read and unread alike.
   *
   * Also returns `unreadCount`, so opening the panel refreshes the badge without a
   * second request.
   */
  getRecent: (): Promise<RecentNotifications> =>
    httpClient.get<RecentNotifications>(NOTIFICATION_ENDPOINTS.recent),

  /**
   * The full screen (US-03).
   *
   * Params are sanitised here rather than trusted from the caller. This endpoint
   * validates — a stale `pageSize` or an unknown `type` is a 422, not a silent
   * fallback — so a value that drifted out of range must never reach the query string.
   */
  list: (params: NotificationsParams = {}): Promise<NotificationsPage> =>
    httpClient.get<NotificationsPage>(
      `${NOTIFICATION_ENDPOINTS.list}${buildNotificationsQuery(sanitiseNotificationsParams(params))}`,
    ),

  /** The Type filter's options (US-03). Static, so the caller caches it for the session. */
  getTypes: (): Promise<NotificationTypeCatalogue> =>
    httpClient.get<NotificationTypeCatalogue>(NOTIFICATION_ENDPOINTS.types),

  /**
   * Marks one row read for the whole restaurant (BR-04).
   *
   * No body. Idempotent — repeating it on an already-read row returns 200 and does not
   * overwrite the original read time, so firing on a double-click is safe.
   *
   * Never redirects: navigation is the client's, using the row's `deepLink`.
   */
  markRead: (id: string): Promise<MarkReadResult> =>
    httpClient.patch<MarkReadResult>(NOTIFICATION_ENDPOINTS.markRead(id), {}),

  /**
   * Marks every unread row read (BR-04, BR-09).
   *
   * Idempotent — with nothing unread it returns `markedCount: 0` rather than failing.
   */
  markAllRead: (): Promise<MarkAllReadResult> =>
    httpClient.patch<MarkAllReadResult>(NOTIFICATION_ENDPOINTS.markAllRead, {}),
}
