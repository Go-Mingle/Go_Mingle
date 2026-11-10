import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { interestTablesService } from '../services'
import type { CreateInterestTablePayload } from '../types'
import { HttpError } from '../../../../shared/api/httpClient'

describe('interestTablesService', () => {
  describe('listAll (cross-restaurant master list)', () => {
    /** Captures the query string the service builds. */
    function captureMasterList() {
      const captured = { search: '' }
      server.use(
        http.get('/api/v1/interest-tables', ({ request }) => {
          captured.search = new URL(request.url).search
          return HttpResponse.json({
            success: true,
            data: {
              items: [],
              pagination: { page: 1, pageSize: 25, totalRecords: 0, totalPages: 1 },
            },
          })
        }),
      )
      return captured
    }

    it('sends no query string when called with no params', async () => {
      const captured = captureMasterList()
      const res = await interestTablesService.listAll()
      expect(captured.search).toBe('')
      expect(res.pagination.pageSize).toBe(25)
    })

    it('serializes the scalar params', async () => {
      const captured = captureMasterList()
      await interestTablesService.listAll({
        page: 2,
        pageSize: 50,
        sortBy: 'maxGuests',
        sortOrder: 'asc',
        search: 'tasting',
        searchField: 'restaurant',
      })
      const params = new URLSearchParams(captured.search)
      expect(params.get('page')).toBe('2')
      expect(params.get('pageSize')).toBe('50')
      expect(params.get('sortBy')).toBe('maxGuests')
      expect(params.get('sortOrder')).toBe('asc')
      expect(params.get('search')).toBe('tasting')
      expect(params.get('searchField')).toBe('restaurant')
    })

    it('sends multi-select filters as repeated keys', async () => {
      const captured = captureMasterList()
      await interestTablesService.listAll({
        availabilityMode: ['AVAILABLE_NOW', 'COMING_SOON'],
        status: ['PENDING', 'CONFIRMED'],
        restaurantId: ['r1', 'r2'],
      })
      const params = new URLSearchParams(captured.search)
      expect(params.getAll('availabilityMode')).toEqual(['AVAILABLE_NOW', 'COMING_SOON'])
      expect(params.getAll('status')).toEqual(['PENDING', 'CONFIRMED'])
      expect(params.getAll('restaurantId')).toEqual(['r1', 'r2'])
    })

    it('sends inviteOnly=false rather than dropping it', async () => {
      const captured = captureMasterList()
      await interestTablesService.listAll({ inviteOnly: false })
      expect(new URLSearchParams(captured.search).get('inviteOnly')).toBe('false')
    })

    it('omits empty multi-select arrays and an empty search', async () => {
      const captured = captureMasterList()
      await interestTablesService.listAll({ status: [], restaurantId: [], search: '' })
      expect(captured.search).toBe('')
    })

    it('propagates an API validation error', async () => {
      server.use(
        http.get('/api/v1/interest-tables', () =>
          HttpResponse.json(
            { success: false, error: { code: 'ERR_VALIDATION', message: 'Search term too long.' } },
            { status: 400 },
          ),
        ),
      )
      await expect(interestTablesService.listAll({ search: 'x'.repeat(101) })).rejects.toThrow(
        HttpError,
      )
    })
  })

  describe('listByRestaurant', () => {
    it('returns list data on 200 with no query params', async () => {
      let receivedSearch = 'unset'
      server.use(
        http.get('/api/v1/restaurants/:rid/interest-tables', ({ request }) => {
          receivedSearch = new URL(request.url).search
          return HttpResponse.json({
            success: true,
            data: { items: [], total: 0, page: 1, pageSize: 10 },
          })
        }),
      )
      const res = await interestTablesService.listByRestaurant('restaurant-1')
      expect(res).toEqual({ items: [], total: 0, page: 1, pageSize: 10 })
      expect(receivedSearch).toBe('')
    })

    it('serializes every query param when provided', async () => {
      let receivedSearch = ''
      server.use(
        http.get('/api/v1/restaurants/:rid/interest-tables', ({ request }) => {
          receivedSearch = new URL(request.url).search
          return HttpResponse.json({
            success: true,
            data: { items: [], total: 0, page: 2, pageSize: 25 },
          })
        }),
      )
      await interestTablesService.listByRestaurant('restaurant-1', {
        page: 2,
        pageSize: 25,
        sortBy: 'name',
        sortOrder: 'DESC',
        q: 'dinner',
        status: 'PENDING',
      })
      const params = new URLSearchParams(receivedSearch)
      expect(params.get('page')).toBe('2')
      expect(params.get('pageSize')).toBe('25')
      expect(params.get('sortBy')).toBe('name')
      expect(params.get('sortOrder')).toBe('DESC')
      expect(params.get('q')).toBe('dinner')
      expect(params.get('status')).toBe('PENDING')
    })

    it('omits individual params that are undefined', async () => {
      let receivedSearch = 'unset'
      server.use(
        http.get('/api/v1/restaurants/:rid/interest-tables', ({ request }) => {
          receivedSearch = new URL(request.url).search
          return HttpResponse.json({
            success: true,
            data: { items: [], total: 0, page: 1, pageSize: 10 },
          })
        }),
      )
      await interestTablesService.listByRestaurant('restaurant-1', { page: 1 })
      const params = new URLSearchParams(receivedSearch)
      expect(params.get('page')).toBe('1')
      expect(params.has('pageSize')).toBe(false)
      expect(params.has('sortBy')).toBe(false)
      expect(params.has('sortOrder')).toBe(false)
      expect(params.has('q')).toBe(false)
      expect(params.has('status')).toBe(false)
    })

    it('throws HttpError on 500', async () => {
      server.use(
        http.get('/api/v1/restaurants/:rid/interest-tables', () =>
          HttpResponse.json({}, { status: 500 }),
        ),
      )
      await expect(interestTablesService.listByRestaurant('restaurant-1')).rejects.toBeInstanceOf(
        HttpError,
      )
    })

    it('throws on network failure', async () => {
      server.use(http.get('/api/v1/restaurants/:rid/interest-tables', () => HttpResponse.error()))
      await expect(interestTablesService.listByRestaurant('restaurant-1')).rejects.toBeTruthy()
    })
  })

  describe('getDetail', () => {
    it('returns the interest table on 200', async () => {
      server.use(
        http.get('/api/v1/interest-tables/:id', () =>
          HttpResponse.json({ success: true, data: { id: 'it-1', name: 'Table A' } }),
        ),
      )
      expect(await interestTablesService.getDetail('it-1')).toEqual({
        id: 'it-1',
        name: 'Table A',
      })
    })

    it('throws HttpError on 404', async () => {
      server.use(
        http.get('/api/v1/interest-tables/:id', () => HttpResponse.json({}, { status: 404 })),
      )
      await expect(interestTablesService.getDetail('missing')).rejects.toBeInstanceOf(HttpError)
    })

    it('throws on network failure', async () => {
      server.use(http.get('/api/v1/interest-tables/:id', () => HttpResponse.error()))
      await expect(interestTablesService.getDetail('it-1')).rejects.toBeTruthy()
    })
  })

  describe('getMenuOptions', () => {
    it('unwraps data.items and returns the menu options on 200', async () => {
      server.use(
        http.get('/api/v1/interest-tables/:id/menu-options', () =>
          HttpResponse.json({
            success: true,
            data: {
              items: [
                {
                  id: 'm-1',
                  name: 'Chef Menu',
                  pricePkr: 100,
                  courses: [{ course: 'Main Course', choose: 1, options: ['Steak'] }],
                },
              ],
            },
          }),
        ),
      )
      const res = await interestTablesService.getMenuOptions('it-1')
      expect(res).toEqual([
        {
          id: 'm-1',
          name: 'Chef Menu',
          pricePkr: 100,
          courses: [{ course: 'Main Course', choose: 1, options: ['Steak'] }],
        },
      ])
    })

    it('returns an empty array when the response has no items', async () => {
      server.use(
        http.get('/api/v1/interest-tables/:id/menu-options', () =>
          HttpResponse.json({ success: true, data: {} }),
        ),
      )
      expect(await interestTablesService.getMenuOptions('it-1')).toEqual([])
    })

    it('throws HttpError on 500', async () => {
      server.use(
        http.get('/api/v1/interest-tables/:id/menu-options', () =>
          HttpResponse.json({}, { status: 500 }),
        ),
      )
      await expect(interestTablesService.getMenuOptions('it-1')).rejects.toBeInstanceOf(HttpError)
    })

    it('throws on network failure', async () => {
      server.use(http.get('/api/v1/interest-tables/:id/menu-options', () => HttpResponse.error()))
      await expect(interestTablesService.getMenuOptions('it-1')).rejects.toBeTruthy()
    })
  })

  describe('create', () => {
    const payload: CreateInterestTablePayload = {
      name: 'New Table',
      topicId: 'topic-1',
      maxGuests: 4,
      startDate: '2026-08-01',
      startTime: '19:00',
      durationMinutes: 120,
      restaurantTableId: 'table-1',
      menuOptionIds: ['menu-1'],
      availabilityMode: 'AVAILABLE_NOW',
      prominglerEnabled: false,
      inviteOnly: false,
      publish: false,
    }

    it('sends POST payload and unwraps the created table', async () => {
      let receivedBody: unknown
      let receivedMethod = ''
      server.use(
        http.post('/api/v1/restaurants/:rid/interest-tables', async ({ request }) => {
          receivedMethod = request.method
          receivedBody = await request.json()
          return HttpResponse.json({ success: true, data: { id: 'it-2', ...payload } })
        }),
      )
      const res = await interestTablesService.create('restaurant-1', payload)
      expect(receivedMethod).toBe('POST')
      expect(receivedBody).toEqual(payload)
      expect(res).toEqual({ id: 'it-2', ...payload })
    })

    it('throws HttpError on 400', async () => {
      server.use(
        http.post('/api/v1/restaurants/:rid/interest-tables', () =>
          HttpResponse.json({}, { status: 400 }),
        ),
      )
      await expect(interestTablesService.create('restaurant-1', payload)).rejects.toBeInstanceOf(
        HttpError,
      )
    })

    it('throws on network failure', async () => {
      server.use(http.post('/api/v1/restaurants/:rid/interest-tables', () => HttpResponse.error()))
      await expect(interestTablesService.create('restaurant-1', payload)).rejects.toBeTruthy()
    })
  })

  describe('checkAvailability', () => {
    it('sends the correct query params and returns the availability result', async () => {
      let receivedSearch = ''
      server.use(
        http.get('/api/v1/restaurants/:rid/tables/:tid/availability-check', ({ request }) => {
          receivedSearch = new URL(request.url).search
          return HttpResponse.json({
            success: true,
            data: { assignable: true, reason: null },
          })
        }),
      )
      const res = await interestTablesService.checkAvailability('restaurant-1', 'table-1', {
        startDate: '2026-08-01',
        startTime: '19:00',
        durationMinutes: 120,
      })
      const params = new URLSearchParams(receivedSearch)
      expect(params.get('startDate')).toBe('2026-08-01')
      expect(params.get('startTime')).toBe('19:00')
      expect(params.get('durationMinutes')).toBe('120')
      expect(res).toEqual({ assignable: true, reason: null })
    })

    it('returns unassignable with a reason', async () => {
      server.use(
        http.get('/api/v1/restaurants/:rid/tables/:tid/availability-check', () =>
          HttpResponse.json({
            success: true,
            data: { assignable: false, reason: 'Table already booked' },
          }),
        ),
      )
      const res = await interestTablesService.checkAvailability('restaurant-1', 'table-1', {
        startDate: '2026-08-01',
        startTime: '19:00',
        durationMinutes: 120,
      })
      expect(res).toEqual({ assignable: false, reason: 'Table already booked' })
    })

    it('throws HttpError on 500', async () => {
      server.use(
        http.get('/api/v1/restaurants/:rid/tables/:tid/availability-check', () =>
          HttpResponse.json({}, { status: 500 }),
        ),
      )
      await expect(
        interestTablesService.checkAvailability('restaurant-1', 'table-1', {
          startDate: '2026-08-01',
          startTime: '19:00',
          durationMinutes: 120,
        }),
      ).rejects.toBeInstanceOf(HttpError)
    })

    it('throws on network failure', async () => {
      server.use(
        http.get('/api/v1/restaurants/:rid/tables/:tid/availability-check', () =>
          HttpResponse.error(),
        ),
      )
      await expect(
        interestTablesService.checkAvailability('restaurant-1', 'table-1', {
          startDate: '2026-08-01',
          startTime: '19:00',
          durationMinutes: 120,
        }),
      ).rejects.toBeTruthy()
    })
  })

  describe('mutations & invitees', () => {
    it('update PATCHes the payload and returns the table', async () => {
      let body: unknown
      server.use(
        http.patch('/api/v1/interest-tables/it1', async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ success: true, data: { id: 'it1', name: 'Renamed' } })
        }),
      )
      const res = await interestTablesService.update('it1', { name: 'Renamed' })
      expect(body).toEqual({ name: 'Renamed' })
      expect(res.name).toBe('Renamed')
    })

    it('remove resolves on 204', async () => {
      server.use(
        http.delete('/api/v1/interest-tables/it1', () => new HttpResponse(null, { status: 204 })),
      )
      await expect(interestTablesService.remove('it1')).resolves.toBeUndefined()
    })

    it('makeAvailable posts and returns the availability result', async () => {
      server.use(
        http.post('/api/v1/interest-tables/it1/make-available', () =>
          HttpResponse.json({
            success: true,
            data: { id: 'it1', status: 'DRAFT', availability: 'AVAILABLE_NOW' },
          }),
        ),
      )
      expect((await interestTablesService.makeAvailable('it1')).availability).toBe('AVAILABLE_NOW')
    })

    it('getInvitees serializes query params', async () => {
      let search = ''
      server.use(
        http.get('/api/v1/interest-tables/it1/invitees', ({ request }) => {
          search = new URL(request.url).search
          return HttpResponse.json({
            success: true,
            data: {
              items: [],
              pagination: { page: 1, pageSize: 10, totalRecords: 0, totalPages: 1 },
            },
          })
        }),
      )
      await interestTablesService.getInvitees('it1', { status: 'INVITED', q: 'sara' })
      const params = new URLSearchParams(search)
      expect(params.get('status')).toBe('INVITED')
      expect(params.get('q')).toBe('sara')
    })

    it('addInvitee posts the minglerId', async () => {
      let body: unknown
      server.use(
        http.post('/api/v1/interest-tables/it1/invitees', async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ success: true, data: { minglerId: 'm1' } }, { status: 201 })
        }),
      )
      await interestTablesService.addInvitee('it1', 'm1')
      expect(body).toEqual({ minglerId: 'm1' })
    })

    it('removeInvitee deletes and returns the result', async () => {
      server.use(
        http.delete('/api/v1/interest-tables/it1/invitees/m1', () =>
          HttpResponse.json({ success: true, data: { minglerId: 'm1', removed: true } }),
        ),
      )
      expect(await interestTablesService.removeInvitee('it1', 'm1')).toEqual({
        minglerId: 'm1',
        removed: true,
      })
    })

    it('propagates HttpError on failure', async () => {
      server.use(
        http.delete('/api/v1/interest-tables/it1', () => HttpResponse.json({}, { status: 404 })),
      )
      await expect(interestTablesService.remove('it1')).rejects.toBeInstanceOf(HttpError)
    })
  })

  describe('publish / cancel / changePromingler', () => {
    it('publish posts and returns the updated table', async () => {
      server.use(
        http.post('/api/v1/interest-tables/it1/publish', () =>
          HttpResponse.json({ success: true, data: { id: 'it1', status: 'PENDING' } }),
        ),
      )
      expect((await interestTablesService.publish('it1')).status).toBe('PENDING')
    })

    it('cancel posts and returns the cancellation result', async () => {
      server.use(
        http.post('/api/v1/interest-tables/it1/cancel', () =>
          HttpResponse.json({
            success: true,
            data: { id: 'it1', status: 'CANCELLED', cancelledCount: 3 },
          }),
        ),
      )
      expect(await interestTablesService.cancel('it1')).toEqual({
        id: 'it1',
        status: 'CANCELLED',
        cancelledCount: 3,
      })
    })

    it('changePromingler posts the prominglerMinglerId', async () => {
      let body: unknown
      server.use(
        http.post('/api/v1/interest-tables/it1/promingler', async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ success: true, data: { id: 'it1' } })
        }),
      )
      await interestTablesService.changePromingler('it1', 'm9')
      expect(body).toEqual({ prominglerMinglerId: 'm9' })
    })

    it('propagates HttpError when publish fails', async () => {
      server.use(
        http.post('/api/v1/interest-tables/it1/publish', () =>
          HttpResponse.json({}, { status: 409 }),
        ),
      )
      await expect(interestTablesService.publish('it1')).rejects.toBeInstanceOf(HttpError)
    })
  })

  describe('lookups', () => {
    it('getActiveProminglers unwraps items (and empty)', async () => {
      server.use(
        http.get('/api/v1/minglers/prominglers/active', () =>
          HttpResponse.json({
            success: true,
            data: { items: [{ id: 'p1', fullName: 'Bob', phone: '1', email: 'b@b.com' }] },
          }),
        ),
      )
      expect(await interestTablesService.getActiveProminglers()).toHaveLength(1)

      server.use(
        http.get('/api/v1/minglers/prominglers/active', () =>
          HttpResponse.json({ success: true, data: {} }),
        ),
      )
      expect(await interestTablesService.getActiveProminglers()).toEqual([])
    })

    it('getMinglersLookup sends the search param and unwraps items', async () => {
      let search = ''
      server.use(
        http.get('/api/v1/minglers', ({ request }) => {
          search = new URL(request.url).search
          return HttpResponse.json({
            success: true,
            data: { items: [{ id: 'm1', fullName: 'Ann' }] },
          })
        }),
      )
      const res = await interestTablesService.getMinglersLookup('ann')
      expect(new URLSearchParams(search).get('search')).toBe('ann')
      expect(res).toEqual([{ id: 'm1', fullName: 'Ann' }])
    })
  })

  // The master list now returns real backend ids, so detail reads always go over
  // HTTP — there is no mock short-circuit left in the service.
  describe('detail reads always hit the network', () => {
    it('getDetail requests the interest table by id', async () => {
      let requested = ''
      server.use(
        http.get('/api/v1/interest-tables/:id', ({ request }) => {
          requested = new URL(request.url).pathname
          return HttpResponse.json({ success: true, data: { id: 'itv1-1', name: 'From API' } })
        }),
      )
      const res = await interestTablesService.getDetail('itv1-1')
      expect(requested).toBe('/api/v1/interest-tables/itv1-1')
      expect(res.name).toBe('From API')
    })

    it('getMenuOptions requests the menu options over HTTP', async () => {
      let requested = ''
      server.use(
        http.get('/api/v1/interest-tables/:id/menu-options', ({ request }) => {
          requested = new URL(request.url).pathname
          return HttpResponse.json({ success: true, data: { items: [{ id: 'c1' }] } })
        }),
      )
      const res = await interestTablesService.getMenuOptions('itv1-1')
      expect(requested).toBe('/api/v1/interest-tables/itv1-1/menu-options')
      expect(res).toEqual([{ id: 'c1' }])
    })

    it('getInvitees requests the invitees over HTTP', async () => {
      let requested = ''
      server.use(
        http.get('/api/v1/interest-tables/:id/invitees', ({ request }) => {
          requested = new URL(request.url).pathname
          return HttpResponse.json({
            success: true,
            data: {
              items: [],
              pagination: { page: 1, pageSize: 10, totalRecords: 0, totalPages: 1 },
            },
          })
        }),
      )
      await interestTablesService.getInvitees('itv1-1')
      expect(requested).toBe('/api/v1/interest-tables/itv1-1/invitees')
    })
  })
})
