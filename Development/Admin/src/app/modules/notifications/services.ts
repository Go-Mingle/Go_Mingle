import { httpClient } from '../../../shared/api/httpClient'
import { NOTIFICATIONS_ENDPOINTS } from './constants'
import type {
  ListNotificationsParams,
  NotificationsListData,
  RecentNotificationsData,
  UnreadCountData,
  NotificationTypesData,
  MarkReadResult,
  MarkAllReadResult,
} from './types'

export const notificationsService = {
  getUnreadCount: (): Promise<UnreadCountData> =>
    httpClient.get<UnreadCountData>(NOTIFICATIONS_ENDPOINTS.unreadCount),

  getRecent: (): Promise<RecentNotificationsData> =>
    httpClient.get<RecentNotificationsData>(NOTIFICATIONS_ENDPOINTS.recent),

  list: (params: ListNotificationsParams = {}): Promise<NotificationsListData> => {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.type) qs.set('type', params.type)
    if (params.status) qs.set('status', params.status)
    if (params.startDate) qs.set('startDate', params.startDate)
    if (params.endDate) qs.set('endDate', params.endDate)
    if (params.sortDir) qs.set('sortDir', params.sortDir)
    if (params.page !== undefined) qs.set('page', String(params.page))
    if (params.pageSize !== undefined) qs.set('pageSize', String(params.pageSize))
    const str = qs.toString()
    const suffix = str ? `?${str}` : ''
    return httpClient.get<NotificationsListData>(`${NOTIFICATIONS_ENDPOINTS.list}${suffix}`)
  },

  getTypes: (): Promise<NotificationTypesData> =>
    httpClient.get<NotificationTypesData>(NOTIFICATIONS_ENDPOINTS.types),

  markRead: (id: string): Promise<MarkReadResult> =>
    httpClient.patch<MarkReadResult>(NOTIFICATIONS_ENDPOINTS.markRead(id), {}),

  markAllRead: (): Promise<MarkAllReadResult> =>
    httpClient.patch<MarkAllReadResult>(NOTIFICATIONS_ENDPOINTS.markAllRead, {}),
}
