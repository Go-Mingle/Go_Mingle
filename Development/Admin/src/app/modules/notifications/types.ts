/**
 * Canonical notification shape returned by the admin Notifications API (spec J13).
 * `type` is a catalogue key (see GET /notifications/types); it is a free string,
 * not a fixed union — the UI maps known keys to icons and falls back gracefully.
 */
export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  deepLink: string | null
  metadata: Record<string, unknown>
  readAt: string | null
  readByUserId: string | null
  createdAt: string
}

export interface NotificationTypeOption {
  key: string
  label: string
}

export type NotificationStatusFilter = 'all' | 'unread' | 'read'

export interface ListNotificationsParams {
  search?: string
  type?: string
  status?: NotificationStatusFilter
  startDate?: string
  endDate?: string
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: 10 | 25 | 50
}

export interface NotificationsPagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface NotificationsListData {
  items: NotificationItem[]
  pagination: NotificationsPagination
}

export interface UnreadCountData {
  count: number
}

export interface RecentNotificationsData {
  items: NotificationItem[]
}

export interface NotificationTypesData {
  types: NotificationTypeOption[]
}

export interface MarkReadResult {
  id: string
  marked: number
  readAt: string | null
  readByUserId: string | null
}

export interface MarkAllReadResult {
  marked: number
  markedAt: string | null
  markedByUserId: string
}
