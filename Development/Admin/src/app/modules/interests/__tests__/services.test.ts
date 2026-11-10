import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { interestsService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

const BASE = '/api/v1/interests'

describe('interestsService.getActive', () => {
  it('unwraps the { items } envelope', async () => {
    server.use(
      http.get(`${BASE}/active`, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              { id: 'i1', name: 'Wine', groupName: 'Food & Drink' },
              { id: 'i3', name: 'Startups', groupName: 'Business' },
            ],
          },
        }),
      ),
    )
    const res = await interestsService.getActive()
    expect(res).toHaveLength(2)
    expect(res[0].groupName).toBe('Food & Drink')
  })

  it('tolerates a bare array response', async () => {
    server.use(
      http.get(`${BASE}/active`, () =>
        HttpResponse.json([{ id: 'i1', name: 'Wine', groupName: 'Food & Drink' }]),
      ),
    )
    expect(await interestsService.getActive()).toHaveLength(1)
  })

  it('returns [] when the envelope has no items', async () => {
    server.use(http.get(`${BASE}/active`, () => HttpResponse.json({ success: true, data: {} })))
    expect(await interestsService.getActive()).toEqual([])
  })

  it('throws HttpError on 500', async () => {
    server.use(http.get(`${BASE}/active`, () => HttpResponse.json({}, { status: 500 })))
    await expect(interestsService.getActive()).rejects.toBeInstanceOf(HttpError)
  })
})

describe('interestsService.getAll', () => {
  it('sends every list param as a query string', async () => {
    let capturedUrl = ''
    server.use(
      http.get(BASE, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({ success: true, data: { items: [] } })
      }),
    )
    await interestsService.getAll({
      page: 3,
      pageSize: 50,
      q: 'wine',
      sortBy: 'group',
      sortOrder: 'desc',
    })
    expect(capturedUrl).toContain('page=3')
    expect(capturedUrl).toContain('pageSize=50')
    expect(capturedUrl).toContain('q=wine')
    expect(capturedUrl).toContain('sortBy=group')
    expect(capturedUrl).toContain('sortOrder=desc')
  })

  it('omits the query string entirely when no params are given', async () => {
    let capturedUrl = ''
    server.use(
      http.get(BASE, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({ success: true, data: { items: [] } })
      }),
    )
    await interestsService.getAll()
    expect(capturedUrl).not.toContain('?')
  })

  it('returns the items and pagination the API reports', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [{ id: 'i1', name: 'Wine', groupName: 'Food & Drink' }],
            pagination: { page: 2, pageSize: 25, totalRecords: 30, totalPages: 2 },
          },
        }),
      ),
    )
    const res = await interestsService.getAll({ page: 2, pageSize: 25 })
    expect(res.items).toHaveLength(1)
    expect(res.pagination).toEqual({ page: 2, pageSize: 25, totalRecords: 30, totalPages: 2 })
  })

  it('derives pagination when the response omits it', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json({
          success: true,
          data: { items: [{ id: 'i1', name: 'Wine', groupName: 'Food & Drink' }] },
        }),
      ),
    )
    const res = await interestsService.getAll({ page: 1, pageSize: 25 })
    expect(res.items).toHaveLength(1)
    expect(res.pagination).toEqual({ page: 1, pageSize: 25, totalRecords: 1, totalPages: 1 })
  })

  it('tolerates a bare array', async () => {
    server.use(http.get(BASE, () => HttpResponse.json([{ id: 'i1', name: 'W', groupName: 'G' }])))
    const res = await interestsService.getAll()
    expect(res.items).toHaveLength(1)
    expect(res.pagination.totalRecords).toBe(1)
  })

  it('throws on 500', async () => {
    server.use(http.get(BASE, () => HttpResponse.json({}, { status: 500 })))
    await expect(interestsService.getAll()).rejects.toBeInstanceOf(HttpError)
  })
})

describe('interestsService CRUD', () => {
  it('getById returns the record', async () => {
    server.use(
      http.get(`${BASE}/:id`, () =>
        HttpResponse.json({ id: 'i1', name: 'Wine', groupName: 'Food & Drink' }),
      ),
    )
    expect((await interestsService.getById('i1')).name).toBe('Wine')
  })

  it('getById throws on 404', async () => {
    server.use(http.get(`${BASE}/:id`, () => HttpResponse.json({}, { status: 404 })))
    await expect(interestsService.getById('x')).rejects.toBeInstanceOf(HttpError)
  })

  it('create posts the payload', async () => {
    let body: unknown
    server.use(
      http.post(BASE, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'new', ...(body as object) }, { status: 201 })
      }),
    )
    const res = await interestsService.create({ name: 'Golf', groupName: 'Sports' })
    expect(body).toEqual({ name: 'Golf', groupName: 'Sports' })
    expect(res.id).toBe('new')
  })

  it('create throws on 409', async () => {
    server.use(http.post(BASE, () => HttpResponse.json({}, { status: 409 })))
    await expect(interestsService.create({ name: 'Dup', groupName: 'G' })).rejects.toBeInstanceOf(
      HttpError,
    )
  })

  it('update patches the record', async () => {
    let body: unknown
    server.use(
      http.patch(`${BASE}/:id`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'i1', ...(body as object) })
      }),
    )
    await interestsService.update('i1', { name: 'Wine Tasting', groupName: 'Food & Drink' })
    expect(body).toEqual({ name: 'Wine Tasting', groupName: 'Food & Drink' })
  })

  it('update throws on 404', async () => {
    server.use(http.patch(`${BASE}/:id`, () => HttpResponse.json({}, { status: 404 })))
    await expect(
      interestsService.update('x', { name: 'A', groupName: 'B' }),
    ).rejects.toBeInstanceOf(HttpError)
  })

  it('delete resolves on 204', async () => {
    server.use(http.delete(`${BASE}/:id`, () => new HttpResponse(null, { status: 204 })))
    await expect(interestsService.delete('i1')).resolves.toBeUndefined()
  })

  it('delete throws on 500', async () => {
    server.use(http.delete(`${BASE}/:id`, () => HttpResponse.json({}, { status: 500 })))
    await expect(interestsService.delete('i1')).rejects.toBeInstanceOf(HttpError)
  })
})
