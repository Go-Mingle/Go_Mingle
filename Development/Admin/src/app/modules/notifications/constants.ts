import { PAGE_SIZE_OPTIONS } from '../../../shared/constants/pagination'

export const NOTIFICATIONS_ENDPOINTS = {
  list: '/api/v1/notifications',
  recent: '/api/v1/notifications/recent',
  unreadCount: '/api/v1/notifications/unread-count',
  types: '/api/v1/notifications/types',
  markRead: (id: string) => `/api/v1/notifications/${id}/read`,
  markAllRead: '/api/v1/notifications/mark-all-read',
} as const

/** Bell badge polls the unread count on this cadence (spec J13). */
export const NOTIFICATIONS_POLL_INTERVAL_MS = 60_000
export const NOTIFICATIONS_MAX_PREVIEW = 10
export const NOTIFICATIONS_PAGE_SIZES = PAGE_SIZE_OPTIONS
export const NOTIFICATIONS_DEFAULT_PAGE_SIZE = 10
/** Max characters accepted in the notifications search box. */
export const NOTIFICATIONS_SEARCH_MAX_LENGTH = 200
