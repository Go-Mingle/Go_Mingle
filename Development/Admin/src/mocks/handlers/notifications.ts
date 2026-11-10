import { http, HttpResponse } from 'msw'
import type { NotificationItem } from '../../app/modules/notifications/types'
import { parseFlexibleDate } from '../../shared/utils/dateHelpers'

const V1 = '/api/v1/notifications'

function envelope<T>(data: T) {
  return { success: true as const, data }
}

const TYPES: { key: string; label: string }[] = [
  { key: 'RESTAURANT_APPLICATION_SUBMITTED', label: 'New restaurant application' },
  { key: 'RESTAURANT_APPROVED', label: 'Restaurant approved' },
  { key: 'RESTAURANT_REJECTED', label: 'Restaurant rejected' },
  { key: 'RESTAURANT_SUSPENDED', label: 'Restaurant suspended' },
  { key: 'RESTAURANT_UNSUSPENDED', label: 'Restaurant reactivated' },
  { key: 'MINGLER_SUSPENDED', label: 'Mingler suspended' },
  { key: 'MINGLER_UNSUSPENDED', label: 'Mingler reactivated' },
]

// Timestamps use the real API's "DD-MM-YYYY HH:MM" format (not ISO).
function seed(): NotificationItem[] {
  return [
    {
      id: 'n1',
      type: 'RESTAURANT_APPLICATION_SUBMITTED',
      title: 'New Restaurant Application',
      body: 'A new restaurant has submitted an application for approval.',
      deepLink: '/admin/approvals/rest1',
      metadata: { restaurantId: 'rest1', restaurantName: 'Fig & Folk' },
      readAt: null,
      readByUserId: null,
      createdAt: '08-07-2026 10:00',
    },
    {
      id: 'n2',
      type: 'RESTAURANT_SUSPENDED',
      title: 'Restaurant Suspended',
      body: 'Restaurant "La Maison" has been suspended due to policy violations.',
      deepLink: '/admin/restaurants/rest2',
      metadata: {},
      readAt: null,
      readByUserId: null,
      createdAt: '07-07-2026 10:00',
    },
    {
      id: 'n3',
      type: 'RESTAURANT_APPROVED',
      title: 'Restaurant Approved',
      body: 'Restaurant "Aurelia" has been approved and is now live.',
      deepLink: '/admin/restaurants/rest1',
      metadata: {},
      readAt: '06-07-2026 12:00',
      readByUserId: 'u1',
      createdAt: '06-07-2026 10:00',
    },
    {
      id: 'n4',
      type: 'MINGLER_SUSPENDED',
      title: 'Mingler Suspended',
      body: 'A mingler has been suspended for repeated no-shows.',
      deepLink: '/admin/minglers/m1',
      metadata: { minglerId: 'm1' },
      readAt: null,
      readByUserId: null,
      createdAt: '05-07-2026 10:00',
    },
  ]
}

let notifications: NotificationItem[] = seed()

/**
 * Adds a notification to the top of the inbox. The GoMingle API calls this when
 * a cross-portal event happens (a partner submits an application, etc.).
 */
export function pushMockNotification(
  item: Pick<NotificationItem, 'type' | 'title' | 'body' | 'deepLink' | 'metadata'>,
): NotificationItem {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const created = new Date(now.getTime() + 5 * 3_600_000) // Asia/Karachi
  const createdAt = `${pad(created.getUTCDate())}-${pad(created.getUTCMonth() + 1)}-${created.getUTCFullYear()} ${pad(created.getUTCHours())}:${pad(created.getUTCMinutes())}`
  const next: NotificationItem = {
    id: `n-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    readAt: null,
    readByUserId: null,
    createdAt,
    ...item,
  }
  notifications = [next, ...notifications]
  return next
}

/** Test-only: reset the in-memory notifications so cases don't leak state. */
export function __resetNotificationsMock() {
  notifications = seed()
}

export const notificationsHandlers = [
  // GET /api/v1/notifications/unread-count
  http.get(`${V1}/unread-count`, () => {
    const count = notifications.filter((n) => !n.readAt).length
    return HttpResponse.json(envelope({ count }))
  }),

  // GET /api/v1/notifications/recent
  http.get(`${V1}/recent`, () => {
    const items = [...notifications]
      .sort(
        (a, b) =>
          parseFlexibleDate(b.createdAt).valueOf() - parseFlexibleDate(a.createdAt).valueOf(),
      )
      .slice(0, 10)
    return HttpResponse.json(envelope({ items }))
  }),

  // GET /api/v1/notifications/types
  http.get(`${V1}/types`, () => HttpResponse.json(envelope({ types: TYPES }))),

  // GET /api/v1/notifications
  http.get(V1, ({ request }) => {
    const url = new URL(request.url)
    const search = (url.searchParams.get('search') ?? '').toLowerCase()
    const type = url.searchParams.get('type') ?? ''
    const status = url.searchParams.get('status') ?? 'all'
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const sortDir = url.searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc'
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Number(url.searchParams.get('pageSize') ?? 25)

    let items = [...notifications]
    if (search)
      items = items.filter(
        (n) => n.title.toLowerCase().includes(search) || n.body.toLowerCase().includes(search),
      )
    if (type) items = items.filter((n) => n.type === type)
    if (status === 'unread') items = items.filter((n) => !n.readAt)
    if (status === 'read') items = items.filter((n) => !!n.readAt)
    // createdAt is "DD-MM-YYYY HH:MM"; normalise to YYYY-MM-DD for date-range compares.
    const day = (iso: string) => parseFlexibleDate(iso).format('YYYY-MM-DD')
    if (startDate) items = items.filter((n) => day(n.createdAt) >= startDate)
    if (endDate) items = items.filter((n) => day(n.createdAt) <= endDate)

    items.sort((a, b) => {
      const cmp =
        parseFlexibleDate(a.createdAt).valueOf() - parseFlexibleDate(b.createdAt).valueOf()
      return sortDir === 'asc' ? cmp : -cmp
    })

    const totalItems = items.length
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const start = (page - 1) * pageSize
    return HttpResponse.json(
      envelope({
        items: items.slice(start, start + pageSize),
        pagination: { page, pageSize, totalItems, totalPages },
      }),
    )
  }),

  // PATCH /api/v1/notifications/:id/read
  http.patch(`${V1}/:id/read`, ({ params }) => {
    const id = params.id as string
    const n = notifications.find((x) => x.id === id)
    if (!n) {
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_NOTIFICATION_NOT_FOUND', message: 'Not found.' } },
        { status: 404 },
      )
    }
    const alreadyRead = !!n.readAt
    if (!alreadyRead) {
      n.readAt = '2026-07-10T00:00:00Z'
      n.readByUserId = 'u1'
    }
    return HttpResponse.json(
      envelope({
        id,
        marked: alreadyRead ? 0 : 1,
        readAt: n.readAt,
        readByUserId: n.readByUserId,
      }),
    )
  }),

  // PATCH /api/v1/notifications/mark-all-read
  http.patch(`${V1}/mark-all-read`, () => {
    let marked = 0
    notifications.forEach((n) => {
      if (!n.readAt) {
        n.readAt = '2026-07-10T00:00:00Z'
        n.readByUserId = 'u1'
        marked += 1
      }
    })
    return HttpResponse.json(
      envelope({ marked, markedAt: '2026-07-10T00:00:00Z', markedByUserId: 'u1' }),
    )
  }),
]
