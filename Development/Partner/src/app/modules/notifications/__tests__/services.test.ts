import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import {
  clearMockNotifications,
  markMockRead,
  mockReadAt,
  resetMockNotifications,
  setMockUnreadCount,
} from '../../../../mocks/data/partnerNotifications'
import { HttpError } from '../../../../shared/api/httpClient'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { NOTIFICATION_ENDPOINTS } from '../constants'
import { notificationsService } from '../services'

beforeEach(() => {
  resetMockNotifications()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

/** Captures the query string the service actually sent. */
function captureQuery() {
  const seen: string[] = []
  server.use(
    http.get(`*${NOTIFICATION_ENDPOINTS.list}`, ({ request }) => {
      seen.push(new URL(request.url).search)
      return HttpResponse.json({
        success: true,
        data: {
          unreadCount: 0,
          items: [],
          pagination: { page: 1, pageSize: 25, totalRecords: 0, totalPages: 1 },
        },
      })
    }),
  )
  return () => seen
}

describe('getUnreadCount', () => {
  it('returns the shared unread count', async () => {
    await expect(notificationsService.getUnreadCount()).resolves.toEqual({ unreadCount: 6 })
  })

  it('returns zero for an empty inbox', async () => {
    clearMockNotifications()
    await expect(notificationsService.getUnreadCount()).resolves.toEqual({ unreadCount: 0 })
  })

  /** The wire carries the true integer; capping to 99+ is the client's job. */
  it('returns the true integer rather than a capped one', async () => {
    setMockUnreadCount(420)
    await expect(notificationsService.getUnreadCount()).resolves.toEqual({ unreadCount: 420 })
  })

  it('carries no restaurant id — scope comes from the token', () => {
    expect(NOTIFICATION_ENDPOINTS.unreadCount).toBe('/api/v1/partner/notifications/unread-count')
  })
})

describe('getRecent', () => {
  it('returns the newest seven, newest first', async () => {
    const { items } = await notificationsService.getRecent()

    expect(items).toHaveLength(7)
    const times = items.map((item) => Date.parse(item.createdAt))
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('includes read and unread alike', async () => {
    const { items } = await notificationsService.getRecent()
    expect(items.some((item) => item.isRead)).toBe(true)
    expect(items.some((item) => !item.isRead)).toBe(true)
  })

  /** So opening the panel refreshes the badge without a second request. */
  it('returns the unread count alongside the items', async () => {
    const { unreadCount } = await notificationsService.getRecent()
    expect(unreadCount).toBe(6)
  })

  it('returns an empty list rather than failing on an empty inbox', async () => {
    clearMockNotifications()
    await expect(notificationsService.getRecent()).resolves.toEqual({
      unreadCount: 0,
      items: [],
    })
  })
})

describe('list — the row shape', () => {
  it('returns the nested pagination envelope', async () => {
    const { pagination } = await notificationsService.list()

    expect(pagination).toEqual({ page: 1, pageSize: 25, totalRecords: 8, totalPages: 1 })
  })

  it('defaults to 25 per page', async () => {
    const { pagination } = await notificationsService.list()
    expect(pagination.pageSize).toBe(25)
  })

  it('renders title and body as stored, never recomposed', async () => {
    const { items } = await notificationsService.list({ search: 'Startup Mixer' })
    const cancelled = items.find((item) => item.id === 'n-1')

    expect(cancelled?.title).toBe('Interest table cancelled')
    expect(cancelled?.body).toContain('Startup Mixer')
  })

  /** The offset is load-bearing — a Z would be rewritten by the platform interceptor. */
  it('carries a +05:00 offset on createdAt, never Z', async () => {
    const { items } = await notificationsService.list()

    expect(items[0].createdAt).toMatch(/\+05:00$/)
    expect(items.every((item) => !item.createdAt.endsWith('Z'))).toBe(true)
  })

  it('exposes a null deepLink rather than omitting it', async () => {
    const { items } = await notificationsService.list()
    expect(items.find((item) => item.id === 'n-7')?.deepLink).toBeNull()
  })

  /** An unrecognised type is legal on a row and must still come back. */
  it('returns a row whose type is not in the catalogue', async () => {
    const { items } = await notificationsService.list()
    expect(items.find((item) => item.id === 'n-6')?.type).toBe('SOMETHING_NEW')
  })

  it('never leaks the fixture-only read bookkeeping', async () => {
    const { items } = await notificationsService.list()
    expect(items[0]).not.toHaveProperty('readAt')
  })
})

describe('list — the badge is not filtered', () => {
  /**
   * The count describes the restaurant, not the page. With a READ filter it legitimately
   * reads 6 beside zero unread rows — wiring the badge to `totalRecords` is the mistake
   * this guards.
   */
  it('reports the same unread count whatever the filter', async () => {
    const unfiltered = await notificationsService.list()
    const readOnly = await notificationsService.list({ status: 'READ' })

    expect(readOnly.unreadCount).toBe(6)
    expect(readOnly.unreadCount).toBe(unfiltered.unreadCount)
    // …while the filtered count genuinely changes.
    expect(readOnly.pagination.totalRecords).toBe(2)
    expect(readOnly.items.every((item) => item.isRead)).toBe(true)
  })

  it('reports it beside a filter that matches nothing', async () => {
    const { unreadCount, items } = await notificationsService.list({ search: 'zzzz' })

    expect(items).toEqual([])
    expect(unreadCount).toBe(6)
  })
})

describe('list — filters', () => {
  it('matches the title', async () => {
    const { items } = await notificationsService.list({ search: 'Promingler' })
    expect(items).toHaveLength(1)
  })

  it('matches the body too, case-insensitively', async () => {
    const { items } = await notificationsService.list({ search: 'BRANZINO' })
    expect(items).toEqual([])

    const hit = await notificationsService.list({ search: 'rooftop' })
    expect(hit.items).toHaveLength(1)
  })

  it('filters by a single type', async () => {
    const { items } = await notificationsService.list({ type: ['IT_CANCELLED'] })

    expect(items).toHaveLength(2)
    expect(items.every((item) => item.type === 'IT_CANCELLED')).toBe(true)
  })

  it('filters by several types at once', async () => {
    const { items } = await notificationsService.list({
      type: ['IT_CANCELLED', 'PROMINGLER_UPDATED'],
    })
    expect(items).toHaveLength(3)
  })

  it.each([
    ['UNREAD', 6],
    ['READ', 2],
    ['ALL', 8],
  ] as const)('filters by the %s status', async (status, expected) => {
    const { pagination } = await notificationsService.list({ status })
    expect(pagination.totalRecords).toBe(expected)
  })

  it('sorts oldest first on request', async () => {
    const { items } = await notificationsService.list({ sortDir: 'asc' })
    const times = items.map((item) => Date.parse(item.createdAt))

    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('pages server-side', async () => {
    const first = await notificationsService.list({ pageSize: 10, page: 1 })
    expect(first.items).toHaveLength(8)
    expect(first.pagination.totalPages).toBe(1)
  })
})

describe('list — validation, which this endpoint really does', () => {
  /** The opposite of J6G's reviews list: bad values are refused, not clamped. */
  it('422s an unknown type key that bypasses the sanitiser', async () => {
    const error = (await notificationsService
      .list({ type: ['NOT_A_TYPE'] })
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(422)
    expect(error.code).toBe('ERR_VALIDATION')
  })

  it('400s a half-supplied date range', async () => {
    server.use(
      http.get(`*${NOTIFICATION_ENDPOINTS.list}`, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_DATE_RANGE_INCOMPLETE',
              message: 'Please provide both a start and end date.',
            },
          },
          { status: 400 },
        ),
      ),
    )

    const error = (await notificationsService.list().catch((e: unknown) => e)) as HttpError
    expect(error.code).toBe('ERR_DATE_RANGE_INCOMPLETE')
  })

  it('400s an inverted range', async () => {
    const error = (await notificationsService
      .list({ startDate: '2026-05-08', endDate: '2026-05-01' })
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(400)
    expect(error.code).toBe('ERR_DATE_RANGE_INVALID')
  })

  it('400s a future end date, which is why the picker blocks it', async () => {
    const error = (await notificationsService
      .list({ startDate: '2026-05-01', endDate: '2099-01-01' })
      .catch((e: unknown) => e)) as HttpError

    expect(error.code).toBe('ERR_DATE_RANGE_INVALID')
  })

  /**
   * Today in **Karachi** is not in the future, even during the four hours when the Karachi date
   * runs a day ahead of the UTC one. Comparing against UTC rejected a partner picking "today"
   * at 01:00 local — and the client's own picker allows it, so the two would disagree.
   */
  it('accepts today in Asia/Karachi as an end date', async () => {
    const karachiToday = new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10)
    const karachiWeekAgo = new Date(Date.now() + 5 * 3_600_000 - 7 * 86_400_000)
      .toISOString()
      .slice(0, 10)

    await expect(
      notificationsService.list({ startDate: karachiWeekAgo, endDate: karachiToday }),
    ).resolves.toBeTruthy()
  })

  /** The sanitiser drops these first, so the 422 is never actually reached. */
  it.each([
    ['a bad status', { status: 'ARCHIVED' }],
    ['a bad sort direction', { sortDir: 'sideways' }],
    ['a refused page size', { pageSize: 100 }],
  ])('never sends %s', async (_label, params) => {
    const query = captureQuery()
    await notificationsService.list(params as never)

    expect(query()[0]).toBe('')
  })

  it('sends the type filter as repeated keys', async () => {
    const query = captureQuery()
    await notificationsService.list({ type: ['IT_CREATED', 'IT_CANCELLED'] })

    expect(new URLSearchParams(query()[0]).getAll('type')).toEqual(['IT_CREATED', 'IT_CANCELLED'])
  })
})

describe('getTypes', () => {
  it('returns the canonical five with labels', async () => {
    const { items } = await notificationsService.getTypes()

    expect(items).toHaveLength(5)
    expect(items.map((item) => item.type)).toEqual([
      'IT_CANCELLED',
      'IT_CONFIRMED',
      'IT_CREATED',
      'MINGLER_CANCELLED_BOOKING',
      'PROMINGLER_UPDATED',
    ])
    expect(items[0].label).toBe('Interest table cancelled')
  })

  /** An unrecognised type renders on a row but is never offered as a filter (BR-02). */
  it('omits a type that exists on a row but not in the catalogue', async () => {
    const { items } = await notificationsService.getTypes()
    expect(items.map((item) => item.type)).not.toContain('SOMETHING_NEW')
  })
})

describe('markRead', () => {
  it('marks the row read and returns the fresh count', async () => {
    const result = await notificationsService.markRead('n-1')

    expect(result).toEqual({ id: 'n-1', isRead: true, unreadCount: 5 })
  })

  it('is reflected in the next list read', async () => {
    await notificationsService.markRead('n-1')
    const { items } = await notificationsService.list()

    expect(items.find((item) => item.id === 'n-1')?.isRead).toBe(true)
  })

  /**
   * Idempotent, and it must not overwrite the original read time — which is what makes
   * firing on a double-click safe.
   */
  it('does not overwrite the original read time when repeated', async () => {
    await notificationsService.markRead('n-1')
    const firstReadAt = mockReadAt('n-1')

    const second = await notificationsService.markRead('n-1')

    expect(second.isRead).toBe(true)
    expect(mockReadAt('n-1')).toBe(firstReadAt)
  })

  it('returns 200 for an already-read row', async () => {
    await expect(notificationsService.markRead('n-7')).resolves.toMatchObject({ isRead: true })
  })

  it('404s for an unknown notification', async () => {
    const error = (await notificationsService
      .markRead('n-nope')
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(404)
    expect(error.code).toBe('ERR_NOT_FOUND')
  })

  /** Read state is shared: one user's mark drops the count for the whole restaurant. */
  it('drops the shared count for every user', async () => {
    markMockRead('n-2')
    await expect(notificationsService.getUnreadCount()).resolves.toEqual({ unreadCount: 5 })
  })
})

describe('markAllRead', () => {
  it('marks every unread row and clears the count', async () => {
    await expect(notificationsService.markAllRead()).resolves.toEqual({
      markedCount: 6,
      unreadCount: 0,
    })
  })

  it('leaves nothing unread behind', async () => {
    await notificationsService.markAllRead()
    const { items } = await notificationsService.list()

    expect(items.every((item) => item.isRead)).toBe(true)
  })

  /** Idempotent — a second call reports nothing to do rather than failing. */
  it('reports zero marked when nothing is unread', async () => {
    await notificationsService.markAllRead()
    await expect(notificationsService.markAllRead()).resolves.toEqual({
      markedCount: 0,
      unreadCount: 0,
    })
  })

  it('reports zero on an empty inbox', async () => {
    clearMockNotifications()
    await expect(notificationsService.markAllRead()).resolves.toEqual({
      markedCount: 0,
      unreadCount: 0,
    })
  })
})

describe('the endpoints', () => {
  it('are all under the versioned partner root', () => {
    expect(NOTIFICATION_ENDPOINTS.list).toBe('/api/v1/partner/notifications')
    expect(NOTIFICATION_ENDPOINTS.recent).toBe('/api/v1/partner/notifications/recent')
    expect(NOTIFICATION_ENDPOINTS.types).toBe('/api/v1/partner/notifications/types')
    expect(NOTIFICATION_ENDPOINTS.markAllRead).toBe('/api/v1/partner/notifications/read-all')
    expect(NOTIFICATION_ENDPOINTS.markRead('n-1')).toBe('/api/v1/partner/notifications/n-1/read')
  })

  it('surfaces the backend message on a server error', async () => {
    server.use(
      http.get(`*${NOTIFICATION_ENDPOINTS.unreadCount}`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL', message: 'Notifications down.' } },
          { status: 500 },
        ),
      ),
    )

    const error = (await notificationsService
      .getUnreadCount()
      .catch((e: unknown) => e)) as HttpError
    expect(error.code).toBe('ERR_INTERNAL')
  })
})
