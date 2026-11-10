import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { amenitiesService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

describe('amenitiesService', () => {
  it('getActive returns active amenities on 200', async () => {
    server.use(
      http.get('/api/v1/amenities/active', () =>
        HttpResponse.json({ items: [{ id: '1', name: 'Wi-Fi' }] }),
      ),
    )
    const res = await amenitiesService.getActive()
    expect(res.items).toHaveLength(1)
  })

  it('getActive throws HttpError on 500', async () => {
    server.use(http.get('/api/v1/amenities/active', () => HttpResponse.json({}, { status: 500 })))
    await expect(amenitiesService.getActive()).rejects.toBeInstanceOf(HttpError)
  })

  it('getById returns an amenity on 200', async () => {
    server.use(
      http.get('/api/v1/amenities/:id', () => HttpResponse.json({ id: '1', name: 'Wi-Fi' })),
    )
    const res = await amenitiesService.getById('1')
    expect(res.id).toBe('1')
  })

  it('getById throws HttpError on 404', async () => {
    server.use(http.get('/api/v1/amenities/:id', () => HttpResponse.json({}, { status: 404 })))
    await expect(amenitiesService.getById('1')).rejects.toBeInstanceOf(HttpError)
  })
})
