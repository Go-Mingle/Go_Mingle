import { HttpResponse } from 'msw'
import { errorResponse } from './partnerRestaurantProfile'
import type {
  MarkAllReadResult,
  MarkReadResult,
  NotificationItem,
  NotificationsPage,
  RecentNotifications,
} from '../../app/modules/notifications/types'

/**
 * J7 notification fixtures — the bell count, the dropdown, the full list and the two
 * mark-read writes.
 *
 * Mirrors the endpoint's real strictness rather than the happy path. The important
 * difference from J6G's reviews fixtures: **this endpoint validates rather than
 * clamps.** An unknown `type`, a bad `status`/`sortDir` or a `pageSize` outside
 * {10,25,50} is a 422, and a half-supplied or inverted range is a 400. Getting that
 * backwards would let a client ship a filter the real API refuses.
 *
 * Other awkward branches deliberately represented:
 *
 *  - `unreadCount` is computed over **every** unread row, before filters, so it and
 *    `pagination.totalRecords` legitimately disagree (a READ filter shows a non-zero
 *    badge beside zero rows).
 *  - read state is **shared and irreversible** — `markMockRead` is idempotent and never
 *    overwrites the original read time, and there is no un-read path.
 *  - one row carries an **unknown `type`**, which is legal and must still render.
 *  - one row has a **null `deepLink`**, and one points at an interest table that does
 *    not exist, for the two BR-10 branches.
 *  - `createdAt` values carry a **+05:00 offset**, never `Z` — a Z-suffixed value would
 *    be rewritten by the platform interceptor and destroy the relative ladder.
 *  - timestamps span every rung of the BR-11 ladder.
 */

/** Anchors the seed relative to "now" so the ladder is exercised on every run. */
const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

/**
 * Rendered with an explicit +05:00 offset, as the backend sends it.
 *
 * `toISOString()` would emit `Z`, which is exactly the shape that must not appear.
 */
function karachiIso(msAgo: number): string {
  const at = new Date(Date.now() - msAgo)
  // Shift into Karachi wall-clock, then label the offset rather than converting away.
  const shifted = new Date(at.getTime() + 5 * HOUR)
  return `${shifted.toISOString().slice(0, 19)}+05:00`
}

interface MockNotification extends NotificationItem {
  /** Set on first read and never overwritten — proves the write is idempotent. */
  readAt: string | null
}

function seed(): MockNotification[] {
  return [
    {
      id: 'n-1',
      type: 'IT_CANCELLED',
      title: 'Interest table cancelled',
      body: 'Your interest table Startup Mixer scheduled for 12 May 2026 has been cancelled.',
      deepLink: '/restaurant-profile/interest-tables/it-1',
      metadata: {
        interestTableId: 'it-1',
        interestTableName: 'Startup Mixer',
        scheduledDate: '12-05-2026',
      },
      isRead: false,
      createdAt: karachiIso(30_000),
      readAt: null,
    },
    {
      id: 'n-2',
      type: 'IT_CONFIRMED',
      title: 'Interest table confirmed',
      body: 'Your interest table Friday Wine Evening scheduled for 15 May 2026 has been confirmed.',
      deepLink: '/restaurant-profile/interest-tables/it-2',
      metadata: { interestTableId: 'it-2', interestTableName: 'Friday Wine Evening' },
      isRead: false,
      createdAt: karachiIso(12 * MINUTE),
      readAt: null,
    },
    {
      id: 'n-3',
      type: 'MINGLER_CANCELLED_BOOKING',
      title: 'Mingler cancelled a booking',
      body: 'A Mingler has cancelled their booking on Startup Mixer scheduled for 12 May 2026.',
      // The Bookings-tab variant, which the resolver must preserve.
      deepLink: '/restaurant-profile/interest-tables/it-1?tab=bookings',
      metadata: { interestTableId: 'it-1', bookingId: 'b-9' },
      isRead: false,
      createdAt: karachiIso(3 * HOUR),
      readAt: null,
    },
    {
      id: 'n-4',
      type: 'PROMINGLER_UPDATED',
      title: 'Promingler updated',
      body: 'The Promingler for your interest table Friday Wine Evening on 15 May 2026 has been updated.',
      deepLink: '/restaurant-profile/interest-tables/it-2?tab=bookings',
      metadata: { interestTableId: 'it-2' },
      isRead: false,
      createdAt: karachiIso(2 * DAY),
      readAt: null,
    },
    {
      id: 'n-5',
      type: 'IT_CREATED',
      title: 'New interest table created',
      body: 'A new interest table Rooftop Social has been created for Aurelia on 20 May 2026.',
      // Points at a table that no longer exists — the BR-10 "no longer available" path.
      deepLink: '/restaurant-profile/interest-tables/it-deleted',
      metadata: { interestTableId: 'it-deleted', interestTableName: 'Rooftop Social' },
      isRead: false,
      createdAt: karachiIso(5 * DAY),
      readAt: null,
    },
    {
      id: 'n-6',
      // Legal and deliberate: an unrecognised key must render with a default icon and
      // stay clickable, and must not appear in the Type filter.
      type: 'SOMETHING_NEW',
      title: 'A new kind of update',
      body: 'This type is not in the catalogue yet, and the row still has to render.',
      deepLink: '/restaurant-profile/interest-tables/it-2',
      metadata: {},
      isRead: false,
      createdAt: karachiIso(9 * DAY),
      readAt: null,
    },
    {
      id: 'n-7',
      type: 'IT_CONFIRMED',
      title: 'Interest table confirmed',
      body: 'Your interest table Chef’s Tasting Night scheduled for 2 May 2026 has been confirmed.',
      // No destination — marks read and goes nowhere (AC-04.4).
      deepLink: null,
      metadata: { interestTableId: 'it-3' },
      isRead: true,
      createdAt: karachiIso(21 * DAY),
      readAt: karachiIso(20 * DAY),
    },
    {
      id: 'n-8',
      type: 'IT_CANCELLED',
      title: 'Interest table cancelled',
      body: 'Your interest table Brunch Club scheduled for 28 April 2026 has been cancelled.',
      deepLink: '/restaurant-profile/interest-tables/it-4',
      metadata: { interestTableId: 'it-4', interestTableName: 'Brunch Club' },
      isRead: true,
      createdAt: karachiIso(40 * DAY),
      readAt: karachiIso(39 * DAY),
    },
  ]
}

/** The catalogue — the canonical five, and deliberately not `SOMETHING_NEW`. */
const TYPE_CATALOGUE = [
  { type: 'IT_CANCELLED', label: 'Interest table cancelled' },
  { type: 'IT_CONFIRMED', label: 'Interest table confirmed' },
  { type: 'IT_CREATED', label: 'New interest table created' },
  { type: 'MINGLER_CANCELLED_BOOKING', label: 'Mingler cancelled a booking' },
  { type: 'PROMINGLER_UPDATED', label: 'Promingler updated' },
] as const

const CATALOGUE_KEYS = new Set(TYPE_CATALOGUE.map((entry) => entry.type as string))

let notifications: MockNotification[] = seed()

export function resetMockNotifications(): void {
  notifications = seed()
}

/**
 * Adds a notification to the top of this restaurant's inbox. The GoMingle API
 * calls this for cross-portal events (application approved or declined, etc.).
 */
export function pushMockNotification(
  item: Pick<NotificationItem, 'type' | 'title' | 'body' | 'deepLink' | 'metadata'>,
): NotificationItem {
  const next: MockNotification = {
    id: `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    isRead: false,
    createdAt: karachiIso(0),
    readAt: null,
    ...item,
  }
  notifications = [next, ...notifications]
  return next
}

/** Empties the inbox, for the "no notifications at all" empty state. */
export function clearMockNotifications(): void {
  notifications = []
}

/** Drives the 99+ cap without hand-writing a hundred fixtures. */
export function setMockUnreadCount(count: number): void {
  notifications = Array.from({ length: count }, (_, index) => ({
    id: `n-bulk-${String(index)}`,
    type: 'IT_CREATED',
    title: 'New interest table created',
    body: `Bulk notification ${String(index)}.`,
    deepLink: '/restaurant-profile/interest-tables/it-1',
    metadata: {},
    isRead: false,
    createdAt: karachiIso(index * MINUTE),
    readAt: null,
  }))
}

/** Strips the fixture-only read bookkeeping the API never returns. */
function toItem({ readAt, ...item }: MockNotification): NotificationItem {
  void readAt
  return item
}

function unreadCount(): number {
  return notifications.filter((item) => !item.isRead).length
}

// ── The bell badge ─────────────────────────────────────────────
export function mockUnreadCount(): Response {
  return HttpResponse.json({ success: true, data: { unreadCount: unreadCount() } })
}

// ── The dropdown ───────────────────────────────────────────────
const RECENT_LIMIT = 7

export function mockRecentNotifications(): Response {
  const items = [...notifications]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, RECENT_LIMIT)
    .map(toItem)

  const body: RecentNotifications = { unreadCount: unreadCount(), items }
  return HttpResponse.json({ success: true, data: body })
}

// ── The full list ──────────────────────────────────────────────
export interface NotificationsQuery {
  search?: string | null
  type?: string[]
  status?: string | null
  startDate?: string | null
  endDate?: string | null
  sortDir?: string | null
  page?: string | null
  pageSize?: string | null
}

/** Today's calendar date in Asia/Karachi, as `YYYY-MM-DD`. */
function karachiToday(): string {
  return new Date(Date.now() + 5 * HOUR).toISOString().slice(0, 10)
}

const STATUSES = ['ALL', 'UNREAD', 'READ']
const SORT_DIRS = ['desc', 'asc']
const PAGE_SIZES = [10, 25, 50]
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * The validation this endpoint really performs. Unlike J6G's reviews list, nothing here
 * is clamped into range — a bad value is refused.
 */
function validate(query: NotificationsQuery): Response | null {
  const { startDate, endDate } = query

  // Both or neither (400, distinct from the 422s below).
  if (Boolean(startDate) !== Boolean(endDate)) {
    return errorResponse(
      'ERR_DATE_RANGE_INCOMPLETE',
      'Please provide both a start and end date.',
      400,
    )
  }
  if (startDate && endDate) {
    const badFormat = !ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)
    const inverted = startDate > endDate
    // An end date in the future is refused, which is why the picker blocks it.
    //
    // Compared against today in **Asia/Karachi**, not UTC. These are Karachi calendar dates, and
    // for the four hours after Karachi midnight the Karachi date is a day ahead of the UTC one —
    // so a UTC comparison rejects a partner picking "today" at 01:00 local as being in the
    // future. The client's own `isDateOutsideWindow` uses Karachi days, so a UTC check here
    // would also put the two out of step.
    const future = endDate > karachiToday()
    if (badFormat || inverted || future) {
      return errorResponse('ERR_DATE_RANGE_INVALID', 'Please provide a valid date range.', 400)
    }
  }

  if (query.status && !STATUSES.includes(query.status)) {
    return errorResponse('ERR_VALIDATION', 'Please check the values and try again.', 422)
  }
  if (query.sortDir && !SORT_DIRS.includes(query.sortDir)) {
    return errorResponse('ERR_VALIDATION', 'Please check the values and try again.', 422)
  }
  if (query.pageSize && !PAGE_SIZES.includes(Number(query.pageSize))) {
    return errorResponse('ERR_VALIDATION', 'Please check the values and try again.', 422)
  }
  // Only catalogue keys are accepted as a *filter*, even though an unknown key is legal
  // on a row.
  const unknown = (query.type ?? []).filter((key) => !CATALOGUE_KEYS.has(key))
  if (unknown.length > 0) {
    return errorResponse('ERR_VALIDATION', 'Please check the values and try again.', 422)
  }

  return null
}

function matchesSearch(item: MockNotification, needle: string): boolean {
  const term = needle.toLowerCase()
  return item.title.toLowerCase().includes(term) || item.body.toLowerCase().includes(term)
}

export function listMockNotifications(query: NotificationsQuery): Response {
  const invalid = validate(query)
  if (invalid) return invalid

  // Computed before filtering, on purpose: it describes the restaurant's badge, not the
  // filtered page (BR-06).
  const badge = unreadCount()

  let rows = [...notifications]

  const search = query.search?.trim()
  if (search) rows = rows.filter((item) => matchesSearch(item, search))

  if (query.type?.length) {
    const wanted = new Set(query.type)
    rows = rows.filter((item) => wanted.has(item.type))
  }

  if (query.status === 'UNREAD') rows = rows.filter((item) => !item.isRead)
  if (query.status === 'READ') rows = rows.filter((item) => item.isRead)

  if (query.startDate && query.endDate) {
    const from = Date.parse(`${query.startDate}T00:00:00+05:00`)
    const to = Date.parse(`${query.endDate}T23:59:59+05:00`)
    rows = rows.filter((item) => {
      const at = Date.parse(item.createdAt)
      return at >= from && at <= to
    })
  }

  const ascending = query.sortDir === 'asc'
  rows.sort((a, b) => {
    const diff = Date.parse(a.createdAt) - Date.parse(b.createdAt)
    if (diff !== 0) return ascending ? diff : -diff
    // A stable secondary key keeps paging deterministic when timestamps tie.
    return a.id.localeCompare(b.id)
  })

  const pageSize = query.pageSize ? Number(query.pageSize) : 25
  const totalRecords = rows.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const requested = Number(query.page)
  const page = Number.isInteger(requested) && requested >= 1 ? Math.min(requested, totalPages) : 1
  const start = (page - 1) * pageSize

  const body: NotificationsPage = {
    unreadCount: badge,
    items: rows.slice(start, start + pageSize).map(toItem),
    pagination: { page, pageSize, totalRecords, totalPages },
  }
  return HttpResponse.json({ success: true, data: body })
}

// ── The catalogue ──────────────────────────────────────────────
export function mockNotificationTypes(): Response {
  return HttpResponse.json({ success: true, data: { items: [...TYPE_CATALOGUE] } })
}

// ── The two writes ─────────────────────────────────────────────
/**
 * Marks one row read for the whole restaurant.
 *
 * Idempotent: repeating it returns 200 and leaves the original `readAt` alone, which is
 * what makes firing on a double-click safe.
 */
export function markMockRead(id: string): Response {
  const item = notifications.find((row) => row.id === id)
  if (!item) return errorResponse('ERR_NOT_FOUND', 'Notification not found.', 404)

  if (!item.isRead) {
    item.isRead = true
    item.readAt = karachiIso(0)
  }

  const body: MarkReadResult = { id, isRead: true, unreadCount: unreadCount() }
  return HttpResponse.json({ success: true, data: body })
}

/** Marks everything read. Idempotent — `markedCount: 0` when nothing was unread. */
export function markAllMockRead(): Response {
  const unread = notifications.filter((item) => !item.isRead)
  unread.forEach((item) => {
    item.isRead = true
    item.readAt = karachiIso(0)
  })

  const body: MarkAllReadResult = { markedCount: unread.length, unreadCount: 0 }
  return HttpResponse.json({ success: true, data: body })
}

/** Reads the shared read state back, for asserting the idempotency contract. */
export function mockReadAt(id: string): string | null {
  return notifications.find((row) => row.id === id)?.readAt ?? null
}
