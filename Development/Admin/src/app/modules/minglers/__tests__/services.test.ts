import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { minglersService, adminBookingsService, reviewsService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

const emptyList = {
  success: true,
  data: {
    items: [],
    pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 1 },
  },
}

describe('minglersService', () => {
  it('getAll on 200', async () => {
    server.use(http.get('/api/v1/minglers', () => HttpResponse.json(emptyList)))
    expect(await minglersService.getAll()).toEqual(emptyList.data)
  })

  it('getAll builds query params from the given filters, including simultaneous name/phone/email', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/minglers', ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json(emptyList)
      }),
    )
    await minglersService.getAll({
      page: 2,
      pageSize: 50,
      sortBy: 'joined_at',
      sortOrder: 'desc',
      name: 'sana',
      phone: '971',
      email: 'sana@example.com',
      joinedFrom: '2024-01-01',
      joinedTo: '2024-12-31',
      statuses: ['ACTIVE', 'SUSPENDED'],
    })
    expect(capturedUrl?.searchParams.get('page')).toBe('2')
    expect(capturedUrl?.searchParams.get('pageSize')).toBe('50')
    expect(capturedUrl?.searchParams.get('sortBy')).toBe('joined_at')
    expect(capturedUrl?.searchParams.get('sortOrder')).toBe('desc')
    expect(capturedUrl?.searchParams.get('name')).toBe('sana')
    expect(capturedUrl?.searchParams.get('phone')).toBe('971')
    expect(capturedUrl?.searchParams.get('email')).toBe('sana@example.com')
    expect(capturedUrl?.searchParams.has('search')).toBe(false)
    expect(capturedUrl?.searchParams.has('searchField')).toBe(false)
    expect(capturedUrl?.searchParams.get('joinedFrom')).toBe('2024-01-01')
    expect(capturedUrl?.searchParams.get('joinedTo')).toBe('2024-12-31')
    expect(capturedUrl?.searchParams.getAll('statuses')).toEqual(['ACTIVE', 'SUSPENDED'])
  })

  it('getAll throws on 500', async () => {
    server.use(http.get('/api/v1/minglers', () => HttpResponse.json({}, { status: 500 })))
    await expect(minglersService.getAll()).rejects.toBeInstanceOf(HttpError)
  })

  it('getAll network failure', async () => {
    server.use(http.get('/api/v1/minglers', () => HttpResponse.error()))
    await expect(minglersService.getAll()).rejects.toBeTruthy()
  })

  it('getById on 200', async () => {
    server.use(http.get('/api/v1/minglers/:id', () => HttpResponse.json({ id: '1' })))
    expect(await minglersService.getById('1')).toEqual({ id: '1' })
  })

  it('getById throws on 404', async () => {
    server.use(http.get('/api/v1/minglers/:id', () => HttpResponse.json({}, { status: 404 })))
    await expect(minglersService.getById('1')).rejects.toBeInstanceOf(HttpError)
  })

  it('suspend posts { reason } to the suspend endpoint', async () => {
    let capturedBody: unknown
    server.use(
      http.post('/api/v1/minglers/:id/suspend', async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({
          success: true,
          data: {
            id: '1',
            status: 'SUSPENDED',
            suspendedAt: '2026-07-08T13:50:33.529Z',
            suspendedReason: 'reason text',
            bookingsCancelled: 3,
          },
        })
      }),
    )
    const result = await minglersService.suspend('1', 'reason text')
    expect(capturedBody).toEqual({ reason: 'reason text' })
    expect(result.bookingsCancelled).toBe(3)
  })

  it('reactivate posts to the reactivate endpoint', async () => {
    server.use(
      http.post('/api/v1/minglers/:id/reactivate', () =>
        HttpResponse.json({
          success: true,
          data: { id: '1', status: 'ACTIVE', reactivatedAt: '2026-07-08T13:53:11.985Z' },
        }),
      ),
    )
    const result = await minglersService.reactivate('1')
    expect(result.status).toBe('ACTIVE')
  })

  it('getActiveBookingsCount unwraps the count field', async () => {
    server.use(
      http.get('/api/v1/minglers/:id/bookings/count-active', () =>
        HttpResponse.json({ success: true, data: { count: 5 } }),
      ),
    )
    expect(await minglersService.getActiveBookingsCount('1')).toBe(5)
  })

  it('setPromingler patches { isPromingler } to the promingler endpoint', async () => {
    let capturedBody: unknown
    server.use(
      http.patch('/api/v1/minglers/:id/promingler', async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ success: true, data: { id: '1', isPromingler: true } })
      }),
    )
    const result = await minglersService.setPromingler('1', true)
    expect(capturedBody).toEqual({ isPromingler: true })
    expect(result.isPromingler).toBe(true)
  })

  it('getEatingPreferences returns the items list', async () => {
    server.use(
      http.get('/api/v1/minglers/:id/eating-preferences', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              { questionId: 'q1', question: 'Q?', type: 'SINGLE_SELECT', selectedOptions: [] },
            ],
          },
        }),
      ),
    )
    const result = await minglersService.getEatingPreferences('1')
    expect(result.items).toHaveLength(1)
  })

  it('getPaymentMethods returns the items list', async () => {
    server.use(
      http.get('/api/v1/minglers/:id/payment-methods', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                paymentMethodId: 'pm1',
                brand: 'VISA',
                last4: '4821',
                expiryMonth: 9,
                expiryYear: 2028,
                isDefault: true,
                cardType: 'CREDIT',
              },
            ],
          },
        }),
      ),
    )
    const result = await minglersService.getPaymentMethods('1')
    expect(result.items).toHaveLength(1)
  })

  it('setDefaultPaymentMethod posts to the set-default endpoint', async () => {
    server.use(
      http.post('/api/v1/minglers/:id/payment-methods/:pmId/set-default', () =>
        HttpResponse.json({ success: true, data: { paymentMethodId: 'pm1', isDefault: true } }),
      ),
    )
    const result = await minglersService.setDefaultPaymentMethod('1', 'pm1')
    expect(result.isDefault).toBe(true)
  })
})

describe('adminBookingsService', () => {
  it('getAll builds query params (comma-joined status, required minglerId)', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/admin/bookings', ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 1, pageSize: 10, totalRecords: 0, totalPages: 1 },
          },
        })
      }),
    )
    await adminBookingsService.getAll({
      minglerId: 'm1',
      status: ['PENDING', 'CONFIRMED'],
      page: 2,
      pageSize: 25,
      sortBy: 'restaurant',
      sortOrder: 'asc',
    })
    expect(capturedUrl?.searchParams.get('minglerId')).toBe('m1')
    expect(capturedUrl?.searchParams.get('status')).toBe('PENDING,CONFIRMED')
    expect(capturedUrl?.searchParams.get('page')).toBe('2')
    expect(capturedUrl?.searchParams.get('pageSize')).toBe('25')
    expect(capturedUrl?.searchParams.get('sortBy')).toBe('restaurant')
    expect(capturedUrl?.searchParams.get('sortOrder')).toBe('asc')
  })

  it('getAll throws on 500', async () => {
    server.use(http.get('/api/v1/admin/bookings', () => HttpResponse.json({}, { status: 500 })))
    await expect(adminBookingsService.getAll({ minglerId: 'm1' })).rejects.toBeInstanceOf(HttpError)
  })
})

describe('reviewsService', () => {
  const emptyReviews = {
    success: true,
    data: {
      items: [],
      pagination: { page: 1, pageSize: 10, totalRecords: 0, totalPages: 1 },
    },
  }

  it('getAll serialises minglerId, q, ratingFilter (CSV), page/size and sort', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/admin/reviews', ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json(emptyReviews)
      }),
    )
    await reviewsService.getAll({
      minglerId: 'm1',
      q: 'truffle',
      ratingFilter: [4, 5],
      page: 2,
      pageSize: 25,
      sortBy: 'rating',
      sortOrder: 'asc',
    })
    expect(capturedUrl?.searchParams.get('minglerId')).toBe('m1')
    expect(capturedUrl?.searchParams.get('q')).toBe('truffle')
    expect(capturedUrl?.searchParams.get('ratingFilter')).toBe('4,5')
    expect(capturedUrl?.searchParams.get('page')).toBe('2')
    expect(capturedUrl?.searchParams.get('pageSize')).toBe('25')
    expect(capturedUrl?.searchParams.get('sortBy')).toBe('rating')
    expect(capturedUrl?.searchParams.get('sortOrder')).toBe('asc')
  })

  it('getAll omits optional params when not provided', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/admin/reviews', ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json(emptyReviews)
      }),
    )
    await reviewsService.getAll({ minglerId: 'm1' })
    expect(capturedUrl?.searchParams.get('minglerId')).toBe('m1')
    expect(capturedUrl?.searchParams.has('q')).toBe(false)
    expect(capturedUrl?.searchParams.has('ratingFilter')).toBe(false)
  })

  it('getAll throws on 500', async () => {
    server.use(http.get('/api/v1/admin/reviews', () => HttpResponse.json({}, { status: 500 })))
    await expect(reviewsService.getAll({ minglerId: 'm1' })).rejects.toBeInstanceOf(HttpError)
  })

  it('getById returns the review detail', async () => {
    server.use(
      http.get('/api/v1/reviews/:id', () =>
        HttpResponse.json({
          success: true,
          data: {
            id: 'rev1',
            restaurantName: 'Aurelia',
            minglerName: 'Sana Khan',
            rating: 5,
            body: 'Superb',
            photoUrls: [],
            date: '2026-04-22',
          },
        }),
      ),
    )
    const result = await reviewsService.getById('rev1')
    expect(result.restaurantName).toBe('Aurelia')
    expect(result.rating).toBe(5)
  })

  it('getById throws on 404', async () => {
    server.use(http.get('/api/v1/reviews/:id', () => HttpResponse.json({}, { status: 404 })))
    await expect(reviewsService.getById('nope')).rejects.toBeInstanceOf(HttpError)
  })

  it('remove resolves on 204', async () => {
    server.use(http.delete('/api/v1/reviews/:id', () => new HttpResponse(null, { status: 204 })))
    await expect(reviewsService.remove('rev1')).resolves.toBeUndefined()
  })

  it('remove throws HttpError on 404', async () => {
    server.use(http.delete('/api/v1/reviews/:id', () => HttpResponse.json({}, { status: 404 })))
    await expect(reviewsService.remove('rev1')).rejects.toBeInstanceOf(HttpError)
  })
})
