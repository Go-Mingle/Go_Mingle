import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { financesService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

describe('financesService', () => {
  it('getAll on 200 with an empty page', async () => {
    server.use(
      http.get('/api/v1/admin/finances', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 1, pageSize: 25, totalRecords: 0, totalPages: 0 },
          },
        }),
      ),
    )
    expect(await financesService.getAll()).toEqual({
      items: [],
      pagination: { page: 1, pageSize: 25, totalRecords: 0, totalPages: 0 },
    })
  })

  it('maps the nested restaurant/mingler list API shape to flat FinanceRecords', async () => {
    server.use(
      http.get('/api/v1/admin/finances', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                bookingRef: 'MNGL-DEV-FIN-003',
                restaurant: {
                  id: '05d9cf3c-7f2f-4953-a46d-8c66aea9e1ad',
                  name: 'Aurelia Dining',
                  city: 'Karachi',
                  address: null,
                  lat: null,
                  lng: null,
                  avatarUrl: null,
                },
                mingler: { id: '7cd3b872-bac9-4d0f-9fa2-526f18179281', name: 'Laila Farooqui' },
                interestTableName: 'Wine & Dine Evening',
                date: '29-06-2026',
                eventStart: '',
                eventEnd: '',
                totalAmountPkr: 261,
                partnerSharePkr: 196,
                gomingleSharePkr: 65,
              },
            ],
            pagination: { page: 1, pageSize: 25, totalRecords: 1, totalPages: 1 },
          },
        }),
      ),
    )
    const result = await financesService.getAll()
    expect(result.pagination).toEqual({ page: 1, pageSize: 25, totalRecords: 1, totalPages: 1 })
    expect(result.items).toEqual([
      {
        id: 'MNGL-DEV-FIN-003',
        bookingId: 'MNGL-DEV-FIN-003',
        restaurant: 'Aurelia Dining',
        restaurantId: '05d9cf3c-7f2f-4953-a46d-8c66aea9e1ad',
        restaurantCity: 'Karachi',
        restaurantAddress: undefined,
        restaurantInfo: { name: 'Aurelia Dining', address: '', city: 'Karachi' },
        mingler: 'Laila Farooqui',
        minglerId: '7cd3b872-bac9-4d0f-9fa2-526f18179281',
        interestTableTopic: 'Wine & Dine Evening',
        date: '29-06-2026',
        totalAmount: 261,
        partnerShare: 196,
        gomingleShare: 65,
      },
    ])
  })

  it('forwards search/sort/date-range/pagination params to the list endpoint', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/admin/finances', ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 2, pageSize: 50, totalRecords: 0, totalPages: 0 },
          },
        })
      }),
    )
    await financesService.getAll({
      restaurant: 'Alpha',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      page: 2,
      pageSize: 50,
      sortBy: 'total',
      sortOrder: 'asc',
    })
    expect(capturedUrl?.searchParams.get('restaurant')).toBe('Alpha')
    // The single `q` + `searchField` pair is gone (CR-62 / MET-753).
    expect(capturedUrl?.searchParams.get('q')).toBeNull()
    expect(capturedUrl?.searchParams.get('searchField')).toBeNull()
    expect(capturedUrl?.searchParams.get('dateFrom')).toBe('2026-01-01')
    expect(capturedUrl?.searchParams.get('dateTo')).toBe('2026-01-31')
    expect(capturedUrl?.searchParams.get('page')).toBe('2')
    expect(capturedUrl?.searchParams.get('pageSize')).toBe('50')
    expect(capturedUrl?.searchParams.get('sortBy')).toBe('total')
    expect(capturedUrl?.searchParams.get('sortOrder')).toBe('asc')
  })

  it('defaults page and pageSize when no params are given', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/admin/finances', ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 1, pageSize: 25, totalRecords: 0, totalPages: 0 },
          },
        })
      }),
    )
    await financesService.getAll()
    expect(capturedUrl?.searchParams.get('page')).toBe('1')
    expect(capturedUrl?.searchParams.get('pageSize')).toBe('10')
    expect(capturedUrl?.searchParams.has('q')).toBe(false)
    expect(capturedUrl?.searchParams.has('sortBy')).toBe(false)
  })

  it('throws on 500', async () => {
    server.use(http.get('/api/v1/admin/finances', () => HttpResponse.json({}, { status: 500 })))
    await expect(financesService.getAll()).rejects.toBeInstanceOf(HttpError)
  })

  it('throws on network error', async () => {
    server.use(http.get('/api/v1/admin/finances', () => HttpResponse.error()))
    await expect(financesService.getAll()).rejects.toBeTruthy()
  })

  it('exportCsv resolves the signed URL and expiry from the export endpoint', async () => {
    server.use(
      http.get('/api/v1/admin/finances/export', () =>
        HttpResponse.json({
          success: true,
          data: { url: 'https://s3.example.com/finances-16-06-2026.csv?sig=abc', expiresIn: 300 },
        }),
      ),
    )
    expect(await financesService.exportCsv()).toEqual({
      url: 'https://s3.example.com/finances-16-06-2026.csv?sig=abc',
      expiresIn: 300,
    })
  })

  it('exportCsv forwards the active date range, search and sort but not pagination', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/admin/finances/export', ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json({
          success: true,
          data: { url: 'https://s3.example.com/finances.csv?sig=abc', expiresIn: 300 },
        })
      }),
    )
    await financesService.exportCsv({
      restaurant: 'Alpha',
      bookingRef: 'BK-0001A2',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      page: 2,
      pageSize: 50,
      sortBy: 'total',
      sortOrder: 'asc',
    })
    expect(capturedUrl?.searchParams.get('restaurant')).toBe('Alpha')
    expect(capturedUrl?.searchParams.get('bookingRef')).toBe('BK-0001A2')
    expect(capturedUrl?.searchParams.get('dateFrom')).toBe('2026-01-01')
    expect(capturedUrl?.searchParams.get('dateTo')).toBe('2026-01-31')
    expect(capturedUrl?.searchParams.get('sortBy')).toBe('total')
    expect(capturedUrl?.searchParams.get('sortOrder')).toBe('asc')
    // The export is un-paginated — page bounds must never be sent (MET-1308).
    expect(capturedUrl?.searchParams.has('page')).toBe(false)
    expect(capturedUrl?.searchParams.has('pageSize')).toBe(false)
  })

  it('exportCsv sends no query string when no filters are active', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/admin/finances/export', ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json({
          success: true,
          data: { url: 'https://s3.example.com/finances.csv?sig=abc', expiresIn: 300 },
        })
      }),
    )
    await financesService.exportCsv()
    expect(capturedUrl?.search).toBe('')
  })

  it('exportCsv throws on 500', async () => {
    server.use(
      http.get('/api/v1/admin/finances/export', () => HttpResponse.json({}, { status: 500 })),
    )
    await expect(financesService.exportCsv()).rejects.toBeInstanceOf(HttpError)
  })

  it('getDetail fetches a single record by booking id', async () => {
    const detail = {
      bookingRef: 'BK-0001A2',
      restaurant: 'Saffron Table',
      mingler: 'Anjali Mehra',
      interestTableName: 'Friday Foodies',
      date: '20-04-2026',
      eventStart: '19:30',
      eventEnd: '21:30',
      partnerSharePkr: 75,
      gomingleSharePkr: 15,
      loyaltyRedeemedPkr: 10,
      loyaltyRedeemedPoints: 100,
      totalAmountPkr: 100,
    }
    server.use(
      http.get('/api/v1/admin/finances/BK-0001A2', () =>
        HttpResponse.json({ success: true, data: detail }),
      ),
    )
    expect(await financesService.getDetail('BK-0001A2')).toEqual(detail)
  })

  it('getDetail throws on 404', async () => {
    server.use(
      http.get('/api/v1/admin/finances/BK-MISSING', () =>
        HttpResponse.json({ error: { message: 'Booking not found' } }, { status: 404 }),
      ),
    )
    await expect(financesService.getDetail('BK-MISSING')).rejects.toBeInstanceOf(HttpError)
  })
})
