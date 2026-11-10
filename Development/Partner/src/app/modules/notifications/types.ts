import type { NOTIFICATION_SORT_DIRS, NOTIFICATION_STATUSES } from './constants'

export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]
export type NotificationSortDir = (typeof NOTIFICATION_SORT_DIRS)[number]

/**
 * One notification, identical on the dropdown and the full screen.
 */
export interface NotificationItem {
  id: string
  /**
   * A catalogue key such as `IT_CANCELLED` — but **deliberately typed as a plain
   * string, not a union**.
   *
   * The wire contract says an unrecognised value is legal and must still render.
   * Typing this as a closed union would make the compiler promise something the API
   * does not, and every `switch` over it would look exhaustive while throwing at
   * runtime on the first new type the backend adds. The icon map has a default arm
   * for exactly this reason; unknown types render and stay clickable, they are just
   * absent from the Type filter (BR-02).
   */
  type: string
  /**
   * Written by the producer at event time and **frozen** (BR-05).
   *
   * Render verbatim. Never recompose from `metadata`, never join to the interest
   * table: if a table is renamed later, the old notification is supposed to keep the
   * old name.
   */
  title: string
  /** Same contract as {@link NotificationItem.title} — stored, frozen, rendered as-is. */
  body: string
  /**
   * A partner-portal **path**, or null for a row that navigates nowhere.
   *
   * Not usable as-is: the stored value is `/restaurant-profile/interest-tables/{id}`
   * and this app has no `/restaurant-profile` route — interest-table detail lives at
   * `/interest-tables/:id`. Always run it through `resolveDeepLink` before navigating.
   */
  deepLink: string | null
  /** Producer-supplied ids. Per-type shape, so deliberately loose. */
  metadata: Record<string, unknown>
  /** Shared across the restaurant, and irreversible once true (BR-04). */
  isRead: boolean
  /**
   * An ISO instant carrying an **Asia/Karachi `+05:00` offset**, e.g.
   * `2026-05-08T14:14:00+05:00`.
   *
   * Do **not** normalise this to `Z`. The offset is load-bearing: a Z-suffixed
   * timestamp is rewritten by a platform-wide response interceptor into a fixed
   * `DD-MM-YYYY HH:MM` string, which would leave nothing to compute relative time
   * from. `new Date()` parses both forms identically, so no special handling is
   * needed — only the discipline not to "fix" it.
   */
  createdAt: string
}

/** The bell badge. */
export interface UnreadCount {
  unreadCount: number
}

/** The dropdown panel: the newest {@link RECENT_LIMIT}, plus the badge count. */
export interface RecentNotifications {
  /**
   * Returned here too, so opening the panel refreshes the badge without a second
   * request. Worth using rather than ignoring.
   */
  unreadCount: number
  items: NotificationItem[]
}

/** Nested, matching J3's, J5's and J6G's pagination envelope. */
export interface NotificationPagination {
  page: number
  pageSize: number
  /** How many rows match the **current filters**. */
  totalRecords: number
  totalPages: number
}

export interface NotificationsPage {
  /**
   * The restaurant's unread count — **not** affected by any filter.
   *
   * It always describes the badge, so with a `READ` filter active this legitimately
   * reads 6 beside zero rows. Never wire the badge to `pagination.totalRecords`.
   */
  unreadCount: number
  items: NotificationItem[]
  pagination: NotificationPagination
}

/** One Type-filter option, from the catalogue endpoint rather than a hardcoded list. */
export interface NotificationTypeOption {
  type: string
  label: string
}

export interface NotificationTypeCatalogue {
  items: NotificationTypeOption[]
}

/**
 * Params for the list endpoint.
 *
 * Unlike J6G's reviews list, this endpoint **validates**: an unknown `type`, a bad
 * `status`/`sortDir`, or a `pageSize` outside {10,25,50} is a 422, and a half-supplied
 * or inverted date range is a 400.
 */
export interface NotificationsParams {
  /** ≤ 255 chars; matches `title` or `body`, case-insensitively. */
  search?: string
  /** Repeatable on the wire (`?type=A&type=B`), never comma-joined. */
  type?: string[]
  status?: NotificationStatus
  /** ISO date, Asia/Karachi. Both or neither — one alone is a 400. */
  startDate?: string
  endDate?: string
  sortDir?: NotificationSortDir
  page?: number
  pageSize?: number
}

/**
 * Mark-one response. Carries the fresh count, which is what the badge should adopt
 * rather than trusting a local decrement.
 */
export interface MarkReadResult {
  id: string
  isRead: true
  unreadCount: number
}

/** Mark-all response. `markedCount` is 0 when nothing was unread — it is idempotent. */
export interface MarkAllReadResult {
  markedCount: number
  unreadCount: number
}
