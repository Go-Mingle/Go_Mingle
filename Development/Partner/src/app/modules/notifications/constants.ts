/**
 * J7 Notifications (Partner Portal).
 *
 * Six client-callable endpoints over `partner_notifications`. Read state is
 * **shared across every user of the restaurant** — one `read_at` per row, so any
 * user marking something read marks it read for the whole team (BR-04). It is also
 * irreversible: there is no mark-as-unread endpoint and none is coming, so nothing
 * here should be built as a toggle.
 *
 * No restaurant id appears on any route — it is resolved from the access token
 * (F1 BR-04), same as J6A–J6G.
 */
const ROOT = '/api/v1/partner/notifications'

export const NOTIFICATION_ENDPOINTS = {
  /** The paginated, filterable full screen. */
  list: ROOT,
  /** The bell badge. Polled by every open tab, so it is the hot one. */
  unreadCount: `${ROOT}/unread-count`,
  /** The dropdown panel — a fixed page of the newest 7. */
  recent: `${ROOT}/recent`,
  /** The Type filter's options. Static and cacheable. */
  types: `${ROOT}/types`,
  markRead: (id: string) => `${ROOT}/${id}/read`,
  markAllRead: `${ROOT}/read-all`,
} as const

export const NOTIFICATION_QUERY_KEY = ['partner', 'notifications'] as const
export const NOTIFICATION_UNREAD_QUERY_KEY = [...NOTIFICATION_QUERY_KEY, 'unread-count'] as const
export const NOTIFICATION_RECENT_QUERY_KEY = [...NOTIFICATION_QUERY_KEY, 'recent'] as const
export const NOTIFICATION_TYPES_QUERY_KEY = [...NOTIFICATION_QUERY_KEY, 'types'] as const
export const NOTIFICATION_LIST_QUERY_KEY = [...NOTIFICATION_QUERY_KEY, 'list'] as const

/**
 * How often the bell count is re-read while the tab is visible (BR-06).
 *
 * Paired with a Page Visibility gate rather than left to run unconditionally: this
 * endpoint is hit by every open tab of every user of the restaurant, so an unpaused
 * poll multiplies across the team.
 *
 * 30s, down from 60s (MET-1262). A minute is too long for the one surface whose whole
 * value is timeliness — a Mingler cancelling a booking should reach a partner who is
 * looking at the screen, and TC-PARTNER-NOTIF-004 checks that inside a ~40s window. The
 * visibility gate is what makes the shorter cadence affordable: only tabs someone is
 * actually watching pay for it, and this endpoint returns a single integer.
 */
export const NOTIFICATION_POLL_MS = 30_000

/** The dropdown shows exactly this many, newest first, read and unread alike (BR-07). */
export const RECENT_LIMIT = 7

/**
 * Page sizes the list endpoint accepts, and its default (BR-08).
 *
 * Unlike J6G's reviews list, this endpoint **rejects** anything else with a 422
 * rather than clamping — so the size control must offer exactly these three.
 */
export const NOTIFICATION_PAGE_SIZES = [10, 25, 50] as const
export const NOTIFICATION_DEFAULT_PAGE_SIZE = 25

export const NOTIFICATION_STATUSES = ['ALL', 'UNREAD', 'READ'] as const
export const NOTIFICATION_SORT_DIRS = ['desc', 'asc'] as const
export const NOTIFICATION_DEFAULT_STATUS = 'ALL'
export const NOTIFICATION_DEFAULT_SORT_DIR = 'desc'

/** Counts above this render as `99+`; the wire always carries the true integer (BR-06). */
export const UNREAD_BADGE_CAP = 99

/**
 * The read window (BR-12). Invisible but real: nothing older is ever returned on any
 * surface, and a `startDate` before the cutoff is silently **clamped** rather than
 * rejected. Surfaced as a hint on the date picker so an empty older range does not
 * read as a bug.
 */
export const NOTIFICATION_WINDOW_DAYS = 90

/**
 * The two J7-specific error codes, both 400s from the list endpoint.
 *
 * The client prevents both — the date-range Apply stays disabled until both dates are
 * set, and future end dates are unselectable — so in normal use neither is reachable.
 * They are mapped anyway: a hand-edited URL or a later refactor should still report
 * the backend's own wording rather than a generic failure.
 */
export const NOTIFICATION_ERROR_CODES = {
  DATE_RANGE_INCOMPLETE: 'ERR_DATE_RANGE_INCOMPLETE',
  DATE_RANGE_INVALID: 'ERR_DATE_RANGE_INVALID',
} as const

// ── SA15 — admin-authored push notifications to Minglers ────────
// A different feature entirely, sharing only the word "notification". Left alone.
export const PUSH_NOTIFICATIONS_ENDPOINTS = {
  list: '/api/push-notifications',
  byId: (id: string) => `/api/push-notifications/${id}`,
} as const

export const PUSH_NOTIFICATIONS_PAGE_SIZE = 25
