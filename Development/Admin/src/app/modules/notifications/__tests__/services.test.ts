import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { notificationsService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

const V1 = '/api/v1/notifications'

function ok<T>(data: T) {
  return HttpResponse.json({ success: true, data })
}

describe('notificationsService', () => {
  it('getUnreadCount returns the count', async () => {
    server.use(http.get(`${V1}/unread-count`, () => ok({ count: 7 })))
    const res = await notificationsService.getUnreadCount()
    expect(res.count).toBe(7)
  })

  it('getRecent returns items', async () => {
    server.use(http.get(`${V1}/recent`, () => ok({ items: [{ id: 'n1' }] })))
    const res = await notificationsService.getRecent()
    expect(res.items).toHaveLength(1)
  })

  it('list serializes filters into query params', async () => {
    let search = ''
    server.use(
      http.get(V1, ({ request }) => {
        search = new URL(request.url).search
        return ok({
          items: [],
          pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
        })
      }),
    )
    await notificationsService.list({
      search: 'hi',
      type: 'approval',
      status: 'unread',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      sortDir: 'asc',
      page: 2,
      pageSize: 25,
    })
    const params = new URLSearchParams(search)
    expect(params.get('search')).toBe('hi')
    expect(params.get('type')).toBe('approval')
    expect(params.get('status')).toBe('unread')
    expect(params.get('startDate')).toBe('2026-07-01')
    expect(params.get('sortDir')).toBe('asc')
    expect(params.get('page')).toBe('2')
    expect(params.get('pageSize')).toBe('25')
  })

  it('getTypes returns the type catalogue', async () => {
    server.use(
      http.get(`${V1}/types`, () => ok({ types: [{ key: 'approval', label: 'Approvals' }] })),
    )
    const res = await notificationsService.getTypes()
    expect(res.types[0].key).toBe('approval')
  })

  it('markRead resolves with the mark result', async () => {
    server.use(
      http.patch(`${V1}/:id/read`, () =>
        ok({ id: 'n1', marked: 1, readAt: 'x', readByUserId: 'u1' }),
      ),
    )
    const res = await notificationsService.markRead('n1')
    expect(res.marked).toBe(1)
  })

  it('markRead throws HttpError on 404', async () => {
    server.use(http.patch(`${V1}/:id/read`, () => HttpResponse.json({}, { status: 404 })))
    await expect(notificationsService.markRead('n1')).rejects.toBeInstanceOf(HttpError)
  })

  it('markAllRead resolves with the count', async () => {
    server.use(
      http.patch(`${V1}/mark-all-read`, () =>
        ok({ marked: 3, markedAt: 'x', markedByUserId: 'u1' }),
      ),
    )
    const res = await notificationsService.markAllRead()
    expect(res.marked).toBe(3)
  })

  it('markAllRead throws HttpError on 500', async () => {
    server.use(http.patch(`${V1}/mark-all-read`, () => HttpResponse.json({}, { status: 500 })))
    await expect(notificationsService.markAllRead()).rejects.toBeInstanceOf(HttpError)
  })
})
