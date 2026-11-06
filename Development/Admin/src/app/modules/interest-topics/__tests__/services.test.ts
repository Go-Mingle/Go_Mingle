import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { interestTopicsService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

const listEnvelope = {
  success: true,
  data: { items: [], pagination: { page: 1, pageSize: 25, totalRecords: 0, totalPages: 1 } },
}

describe('interestTopicsService', () => {
  it('list serialises all query params', async () => {
    let url: URL | undefined
    server.use(
      http.get('/api/v1/topics', ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json(listEnvelope)
      }),
    )
    await interestTopicsService.list({
      page: 2,
      pageSize: 50,
      q: 'wine',
      sortBy: 'name',
      sortOrder: 'desc',
    })
    expect(url?.searchParams.get('page')).toBe('2')
    expect(url?.searchParams.get('pageSize')).toBe('50')
    expect(url?.searchParams.get('q')).toBe('wine')
    expect(url?.searchParams.get('sortBy')).toBe('name')
    expect(url?.searchParams.get('sortOrder')).toBe('desc')
  })

  it('list omits params when none are provided', async () => {
    let url: URL | undefined
    server.use(
      http.get('/api/v1/topics', ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json(listEnvelope)
      }),
    )
    await interestTopicsService.list()
    expect(url?.search).toBe('')
  })

  it('getById returns the topic', async () => {
    server.use(
      http.get('/api/v1/topics/:id', () =>
        HttpResponse.json({ id: 't1', name: 'Wine & Dine', interests: [] }),
      ),
    )
    expect((await interestTopicsService.getById('t1')).name).toBe('Wine & Dine')
  })

  it('getById throws on 404', async () => {
    server.use(http.get('/api/v1/topics/:id', () => HttpResponse.json({}, { status: 404 })))
    await expect(interestTopicsService.getById('x')).rejects.toBeInstanceOf(HttpError)
  })

  it('create posts the payload', async () => {
    let body: unknown
    server.use(
      http.post('/api/v1/topics', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'new', ...(body as object) }, { status: 201 })
      }),
    )
    await interestTopicsService.create({
      name: 'T',
      description: 'A valid topic description.',
      graphicKey: 'topics/t.png',
      interestIds: ['i1'],
    })
    expect((body as { name: string; graphicKey: string }).name).toBe('T')
    expect((body as { graphicKey: string }).graphicKey).toBe('topics/t.png')
  })

  it('update patches the payload', async () => {
    server.use(
      http.patch('/api/v1/topics/:id', async ({ request }) =>
        HttpResponse.json(await request.json()),
      ),
    )
    const res = await interestTopicsService.update('t1', { name: 'Renamed', interestIds: ['i1'] })
    expect((res as { name: string }).name).toBe('Renamed')
  })

  it('delete resolves on 204', async () => {
    server.use(http.delete('/api/v1/topics/:id', () => new HttpResponse(null, { status: 204 })))
    await expect(interestTopicsService.delete('t1')).resolves.toBeUndefined()
  })
})
