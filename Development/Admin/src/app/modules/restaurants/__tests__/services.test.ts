import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { restaurantsService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

describe('restaurantsService', () => {
  it('listRestaurants on 200', async () => {
    server.use(
      http.get('/api/v1/restaurants', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 1, pageSize: 10, totalRecords: 0, totalPages: 1 },
          },
        }),
      ),
    )
    expect(await restaurantsService.listRestaurants()).toEqual({
      items: [],
      pagination: { page: 1, pageSize: 10, totalRecords: 0, totalPages: 1 },
    })
  })

  it('listRestaurants serializes every query param', async () => {
    let receivedSearch = ''
    server.use(
      http.get('/api/v1/restaurants', ({ request }) => {
        receivedSearch = new URL(request.url).search
        return HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 2, pageSize: 25, totalRecords: 0, totalPages: 1 },
          },
        })
      }),
    )
    await restaurantsService.listRestaurants({
      page: 2,
      pageSize: 25,
      sortBy: 'name',
      sortOrder: 'desc',
      q: 'pizza',
      searchField: 'name',
      categoryIds: ['c1', 'c2'],
      cities: 'Karachi',
      statuses: ['ACTIVE', 'SUSPENDED'],
    })
    const params = new URLSearchParams(receivedSearch)
    expect(params.get('page')).toBe('2')
    expect(params.get('pageSize')).toBe('25')
    expect(params.get('sortBy')).toBe('name')
    expect(params.get('sortOrder')).toBe('desc')
    expect(params.get('q')).toBe('pizza')
    expect(params.get('searchField')).toBe('name')
    expect(params.getAll('categoryIds')).toEqual(['c1', 'c2'])
    expect(params.get('cities')).toBe('Karachi')
    expect(params.getAll('statuses')).toEqual(['ACTIVE', 'SUSPENDED'])
  })

  it('listRestaurants omits the query string when no params are given', async () => {
    let receivedSearch = 'unset'
    server.use(
      http.get('/api/v1/restaurants', ({ request }) => {
        receivedSearch = new URL(request.url).search
        return HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 1, pageSize: 10, totalRecords: 0, totalPages: 1 },
          },
        })
      }),
    )
    await restaurantsService.listRestaurants()
    expect(receivedSearch).toBe('')
  })

  it('listRestaurants throws on 500', async () => {
    server.use(http.get('/api/v1/restaurants', () => HttpResponse.json({}, { status: 500 })))
    await expect(restaurantsService.listRestaurants()).rejects.toBeInstanceOf(HttpError)
  })

  it('listRestaurants network failure', async () => {
    server.use(http.get('/api/v1/restaurants', () => HttpResponse.error()))
    await expect(restaurantsService.listRestaurants()).rejects.toBeTruthy()
  })

  it('getRestaurantDetail on 200', async () => {
    server.use(
      http.get('/api/v1/restaurants/:id', () =>
        HttpResponse.json({ success: true, data: { id: '1' } }),
      ),
    )
    expect(await restaurantsService.getRestaurantDetail('1')).toEqual({ id: '1' })
  })

  it('getRestaurantDetail throws on 404', async () => {
    server.use(http.get('/api/v1/restaurants/:id', () => HttpResponse.json({}, { status: 404 })))
    await expect(restaurantsService.getRestaurantDetail('1')).rejects.toBeInstanceOf(HttpError)
  })

  it('getRestaurantTables on 200', async () => {
    server.use(
      http.get('/api/v1/restaurants/:id/tables', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                id: 'table-1',
                name: 'Table 1',
                availability: [{ dayOfWeek: 1, start: '18:00', end: '20:00' }],
              },
            ],
          },
        }),
      ),
    )

    expect(await restaurantsService.getRestaurantTables('restaurant-1')).toEqual({
      items: [
        {
          id: 'table-1',
          name: 'Table 1',
          availability: [{ dayOfWeek: 1, start: '18:00', end: '20:00' }],
        },
      ],
    })
  })

  it('getMenuOptions on 200', async () => {
    server.use(
      http.get('/api/v1/restaurants/:id/menu-options', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                id: 'menu-1',
                name: 'Chef Menu',
                pricePkr: 250,
                courses: [{ course: 'Main Course', choose: 1, options: ['Starter'] }],
              },
            ],
          },
        }),
      ),
    )

    expect(await restaurantsService.getMenuOptions('restaurant-1')).toEqual({
      items: [
        {
          id: 'menu-1',
          name: 'Chef Menu',
          pricePkr: 250,
          courses: [{ course: 'Main Course', choose: 1, options: ['Starter'] }],
        },
      ],
    })
  })

  it('getAmenities on 200 unwraps the items list', async () => {
    server.use(
      http.get('/api/v1/restaurants/:id/amenities', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              { id: 'a1', name: 'Outdoor terrace', iconUrl: 'https://cdn.gomingle.com/a1.svg' },
              { id: 'a2', name: 'View: sea', iconUrl: null },
            ],
          },
        }),
      ),
    )

    expect(await restaurantsService.getAmenities('restaurant-1')).toEqual({
      items: [
        { id: 'a1', name: 'Outdoor terrace', iconUrl: 'https://cdn.gomingle.com/a1.svg' },
        { id: 'a2', name: 'View: sea', iconUrl: null },
      ],
    })
  })

  it('getContacts on 200 preserves nulls verbatim', async () => {
    server.use(
      http.get('/api/v1/restaurants/:id/contacts', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                id: 'ct-1',
                name: 'Osama Khalil',
                title: 'General Manager',
                email: 'osama@aurelia.pk',
                phone: '+923001234567',
              },
              { id: 'ct-2', name: 'Yusuf Amin', title: null, email: null, phone: null },
            ],
          },
        }),
      ),
    )

    expect(await restaurantsService.getContacts('restaurant-1')).toEqual({
      items: [
        {
          id: 'ct-1',
          name: 'Osama Khalil',
          title: 'General Manager',
          email: 'osama@aurelia.pk',
          phone: '+923001234567',
        },
        { id: 'ct-2', name: 'Yusuf Amin', title: null, email: null, phone: null },
      ],
    })
  })

  it('getContacts rejects with HttpError on 404', async () => {
    server.use(
      http.get('/api/v1/restaurants/:id/contacts', () =>
        HttpResponse.json({ error: { code: 'ERR_RESTAURANT_NOT_FOUND' } }, { status: 404 }),
      ),
    )
    await expect(restaurantsService.getContacts('missing')).rejects.toBeInstanceOf(HttpError)
  })

  it('getAmenities rejects with HttpError on 404', async () => {
    server.use(
      http.get('/api/v1/restaurants/:id/amenities', () =>
        HttpResponse.json({ error: { code: 'ERR_RESTAURANT_NOT_FOUND' } }, { status: 404 }),
      ),
    )
    await expect(restaurantsService.getAmenities('missing')).rejects.toBeInstanceOf(HttpError)
  })

  it('changeCategory sends PATCH payload and unwraps result', async () => {
    let payload: unknown
    server.use(
      http.patch('/api/v1/restaurants/:id/category', async ({ request }) => {
        payload = await request.json()
        return HttpResponse.json({
          success: true,
          data: { id: 'restaurant-1', category: { id: 'cat-1', name: 'Premium' } },
        })
      }),
    )

    await expect(
      restaurantsService.changeCategory('restaurant-1', { categoryId: 'cat-1' }),
    ).resolves.toEqual({ id: 'restaurant-1', category: { id: 'cat-1', name: 'Premium' } })
    expect(payload).toEqual({ categoryId: 'cat-1' })
  })

  it('getActiveCategories on 200', async () => {
    server.use(
      http.get('/api/v1/categories/active', () =>
        HttpResponse.json({
          success: true,
          data: { items: [{ id: 'cat-1', name: 'Premium' }] },
        }),
      ),
    )

    expect(await restaurantsService.getActiveCategories()).toEqual([
      { id: 'cat-1', name: 'Premium' },
    ])
  })

  it('getMedia sends the kind query param and returns items', async () => {
    let search = ''
    server.use(
      http.get('/api/v1/restaurants/r1/media', ({ request }) => {
        search = new URL(request.url).search
        return HttpResponse.json({ success: true, data: { items: [] } })
      }),
    )
    await restaurantsService.getMedia('r1', 'DOCUMENT')
    expect(new URLSearchParams(search).get('kind')).toBe('DOCUMENT')
  })

  it('getActiveBookingsCount returns the count', async () => {
    server.use(
      http.get('/api/v1/restaurants/r1/bookings/count-active', () =>
        HttpResponse.json({ success: true, data: { count: 5 } }),
      ),
    )
    expect(await restaurantsService.getActiveBookingsCount('r1')).toEqual({ count: 5 })
  })

  it('suspend posts the reason and returns the result', async () => {
    let body: unknown
    server.use(
      http.post('/api/v1/restaurants/r1/suspend', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          success: true,
          data: { id: 'r1', status: 'SUSPENDED', bookingsCancelled: 2 },
        })
      }),
    )
    const res = await restaurantsService.suspend('r1', { reason: 'policy breach here' })
    expect(body).toEqual({ reason: 'policy breach here' })
    expect(res.status).toBe('SUSPENDED')
  })

  it('unsuspend posts and returns the result', async () => {
    server.use(
      http.post('/api/v1/restaurants/r1/unsuspend', () =>
        HttpResponse.json({ success: true, data: { id: 'r1', status: 'ACTIVE' } }),
      ),
    )
    expect(await restaurantsService.unsuspend('r1')).toEqual({ id: 'r1', status: 'ACTIVE' })
  })

  it('listReviews serializes filters and returns summary + items', async () => {
    let search = ''
    server.use(
      http.get('/api/v1/restaurants/r1/reviews', ({ request }) => {
        search = new URL(request.url).search
        return HttpResponse.json({
          success: true,
          data: {
            summary: {
              average: 4,
              total: 1,
              distribution: {},
              positive: 1,
              neutral: 0,
              negative: 0,
            },
            items: [],
            pagination: { page: 1, pageSize: 10, totalRecords: 0, totalPages: 1 },
          },
        })
      }),
    )
    await restaurantsService.listReviews('r1', {
      q: 'great',
      ratingFilter: [5, 4],
      sortBy: 'rating',
    })
    const params = new URLSearchParams(search)
    expect(params.get('q')).toBe('great')
    expect(params.getAll('ratingFilter')).toEqual(['5', '4'])
    expect(params.get('sortBy')).toBe('rating')
  })

  it('getReviewDetail returns the detail', async () => {
    server.use(
      http.get('/api/v1/reviews/rev1', () =>
        HttpResponse.json({ success: true, data: { id: 'rev1' } }),
      ),
    )
    expect((await restaurantsService.getReviewDetail('rev1')).id).toBe('rev1')
  })

  it('deleteReview resolves on 204', async () => {
    server.use(http.delete('/api/v1/reviews/rev1', () => new HttpResponse(null, { status: 204 })))
    await expect(restaurantsService.deleteReview('rev1')).resolves.toBeUndefined()
  })

  it('getInterestTableLookup returns items', async () => {
    server.use(
      http.get('/api/v1/restaurants/r1/lookups/interest-tables', () =>
        HttpResponse.json({ success: true, data: { items: [] } }),
      ),
    )
    expect(await restaurantsService.getInterestTableLookup('r1')).toEqual({ items: [] })
  })

  it('getBookingDetail returns the booking', async () => {
    server.use(
      http.get('/api/v1/admin/bookings/BK-1', () =>
        HttpResponse.json({ success: true, data: { id: 'BK-1', bookingRef: 'BK-1' } }),
      ),
    )
    expect((await restaurantsService.getBookingDetail('BK-1')).bookingRef).toBe('BK-1')
  })

  it('listBookings serializes scope + paging params', async () => {
    let search = ''
    server.use(
      http.get('/api/v1/admin/bookings', ({ request }) => {
        search = new URL(request.url).search
        return HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 1, pageSize: 50, totalRecords: 0, totalPages: 1 },
          },
        })
      }),
    )
    await restaurantsService.listBookings({
      interestTableId: 'it1',
      status: ['PENDING', 'CONFIRMED'],
      page: 1,
      pageSize: 50,
      sortBy: 'date',
      sortOrder: 'desc',
    })
    const params = new URLSearchParams(search)
    expect(params.get('interestTableId')).toBe('it1')
    expect(params.get('status')).toBe('PENDING,CONFIRMED')
    expect(params.get('pageSize')).toBe('50')
    expect(params.get('sortBy')).toBe('date')
  })

  it('propagates HttpError on failure', async () => {
    server.use(
      http.post('/api/v1/restaurants/r1/suspend', () => HttpResponse.json({}, { status: 409 })),
    )
    await expect(
      restaurantsService.suspend('r1', { reason: 'x'.repeat(12) }),
    ).rejects.toBeInstanceOf(HttpError)
  })
})
