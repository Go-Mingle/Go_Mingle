import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { approvalQueueService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

const LIST = '/api/v1/admin/approvals'

function listEnvelope(
  items: unknown[],
  pagination = { page: 1, pageSize: 25, totalRecords: items.length, totalPages: 1 },
) {
  return HttpResponse.json({ success: true, data: { items, pagination } })
}

const pendingItem = {
  id: 'r1',
  name: 'Wax & Wine',
  cuisine: 'Wine Bar',
  ownerName: 'Farida Hassan',
  ownerPhone: '+92 305 100 2233',
  ownerEmail: 'farida@waxwine.pk',
  city: 'Karachi',
  submittedAt: '28-04-2026',
  avatarUrl: 'https://x/r1.png',
}

describe('approvalQueueService.getAll', () => {
  it('maps API items to the UI row shape (pending)', async () => {
    server.use(http.get(LIST, () => listEnvelope([pendingItem])))
    const res = await approvalQueueService.getAll({ status: 'pending' })
    expect(res.pagination.totalRecords).toBe(1)
    expect(res.items[0]).toMatchObject({
      id: 'r1',
      owner: 'Farida Hassan',
      phone: '+92 305 100 2233',
      email: 'farida@waxwine.pk',
      submitted: '28-04-2026',
      status: 'PENDING',
    })
  })

  it('maps rejected fields (rejectedOn + reason) and status', async () => {
    const rejected = {
      id: 'r9',
      name: 'Terraza',
      cuisine: 'Med',
      ownerName: 'Sofia',
      city: 'Karachi',
      submittedAt: '14-02-2026',
      rejectedAt: '20-02-2026',
      latestReason: 'Licence expired.',
    }
    server.use(http.get(LIST, () => listEnvelope([rejected])))
    const res = await approvalQueueService.getAll({ status: 'rejected' })
    expect(res.items[0]).toMatchObject({
      status: 'REJECTED',
      rejectedOn: '20-02-2026',
      rejectionReason: 'Licence expired.',
      phone: '',
      email: '',
    })
  })

  it('sends all whitelisted query params', async () => {
    let captured = ''
    server.use(
      http.get(LIST, ({ request }) => {
        captured = new URL(request.url).search
        return listEnvelope([])
      }),
    )
    await approvalQueueService.getAll({
      status: 'pending',
      page: 2,
      pageSize: 50,
      sortBy: 'owner',
      sortOrder: 'desc',
      restaurant: 'wax',
      owner: 'farida',
      city: 'karachi',
    })
    expect(captured).toContain('status=pending')
    expect(captured).toContain('page=2')
    expect(captured).toContain('pageSize=50')
    expect(captured).toContain('sortBy=owner')
    expect(captured).toContain('sortOrder=desc')
    expect(captured).toContain('restaurant=wax')
    expect(captured).toContain('owner=farida')
    expect(captured).toContain('city=karachi')
  })

  it('trims and truncates the city param, and drops it when blank', async () => {
    let captured = ''
    server.use(
      http.get(LIST, ({ request }) => {
        captured = new URL(request.url).search
        return listEnvelope([])
      }),
    )
    await approvalQueueService.getAll({ city: `  ${'c'.repeat(150)}  ` })
    expect(new URLSearchParams(captured).get('city')?.length).toBe(100)

    let captured2 = ''
    server.use(
      http.get(LIST, ({ request }) => {
        captured2 = new URL(request.url).search
        return listEnvelope([])
      }),
    )
    await approvalQueueService.getAll({ city: '   ' })
    expect(captured2).not.toContain('city')
  })

  it('trims and truncates restaurant + owner params to 100 chars', async () => {
    let captured = ''
    server.use(
      http.get(LIST, ({ request }) => {
        captured = new URL(request.url).search
        return listEnvelope([])
      }),
    )
    await approvalQueueService.getAll({
      restaurant: `  ${'a'.repeat(150)}  `,
      owner: `  ${'b'.repeat(150)}  `,
    })
    const url = new URLSearchParams(captured)
    expect(url.get('restaurant')?.length).toBe(100)
    expect(url.get('owner')?.length).toBe(100)

    let captured2 = ''
    server.use(
      http.get(LIST, ({ request }) => {
        captured2 = new URL(request.url).search
        return listEnvelope([])
      }),
    )
    await approvalQueueService.getAll({ restaurant: '   ' })
    expect(captured2).not.toContain('restaurant')
  })

  it('defaults to no query string with empty params', async () => {
    let captured = 'unset'
    server.use(
      http.get(LIST, ({ request }) => {
        captured = new URL(request.url).search
        return listEnvelope([])
      }),
    )
    await approvalQueueService.getAll()
    expect(captured).toBe('')
  })

  it('throws HttpError on 500', async () => {
    server.use(http.get(LIST, () => HttpResponse.json({}, { status: 500 })))
    await expect(approvalQueueService.getAll()).rejects.toBeInstanceOf(HttpError)
  })

  it('throws on network failure', async () => {
    server.use(http.get(LIST, () => HttpResponse.error()))
    await expect(approvalQueueService.getAll()).rejects.toBeTruthy()
  })
})

describe('approvalQueueService.getById', () => {
  it('returns detail on 200', async () => {
    server.use(
      http.get(`${LIST}/:id`, () =>
        HttpResponse.json({
          success: true,
          data: {
            id: 'r9',
            name: 'Terraza',
            status: 'REJECTED',
            visibleOnApp: false,
            submittedAt: '14-02-2026',
            rejections: [{ reason: 'x', rejectedAt: '20-02-2026', rejectedBy: 'Hira' }],
          },
        }),
      ),
    )
    const res = await approvalQueueService.getById('r9')
    expect(res.status).toBe('REJECTED')
    expect(res.rejections).toHaveLength(1)
  })

  it('throws HttpError with code on 404', async () => {
    server.use(
      http.get(`${LIST}/:id`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_APPLICATION_NOT_FOUND', message: 'x', details: {} },
          },
          { status: 404 },
        ),
      ),
    )
    await expect(approvalQueueService.getById('nope')).rejects.toMatchObject({
      code: 'ERR_APPLICATION_NOT_FOUND',
    })
  })
})

describe('approvalQueueService.approve / decline', () => {
  it('approve returns the activated restaurant', async () => {
    server.use(
      http.post(`${LIST}/:id/approve`, () =>
        HttpResponse.json({
          success: true,
          data: { id: 'r1', status: 'ACTIVE', category: { id: 'c1', name: 'Premium' } },
        }),
      ),
    )
    const res = await approvalQueueService.approve('r1', { categoryId: 'c1' })
    expect(res.status).toBe('ACTIVE')
    expect(res.category.name).toBe('Premium')
  })

  it('approve throws with code on 409', async () => {
    server.use(
      http.post(`${LIST}/:id/approve`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_APPLICATION_ALREADY_ACTIONED', message: 'x', details: {} },
          },
          { status: 409 },
        ),
      ),
    )
    await expect(approvalQueueService.approve('r1', { categoryId: 'c1' })).rejects.toMatchObject({
      code: 'ERR_APPLICATION_ALREADY_ACTIONED',
    })
  })

  it('decline returns the rejected application', async () => {
    server.use(
      http.post(`${LIST}/:id/decline`, () =>
        HttpResponse.json({
          success: true,
          data: { id: 'r9', status: 'REJECTED', rejectedAt: '20-02-2026' },
        }),
      ),
    )
    const res = await approvalQueueService.decline('r9', { reason: 'A long enough reason.' })
    expect(res.status).toBe('REJECTED')
  })

  it('decline throws with code on 409', async () => {
    server.use(
      http.post(`${LIST}/:id/decline`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_APPLICATION_ALREADY_ACTIONED', message: 'x', details: {} },
          },
          { status: 409 },
        ),
      ),
    )
    await expect(
      approvalQueueService.decline('r9', { reason: 'A long enough reason.' }),
    ).rejects.toMatchObject({
      code: 'ERR_APPLICATION_ALREADY_ACTIONED',
    })
  })
})
