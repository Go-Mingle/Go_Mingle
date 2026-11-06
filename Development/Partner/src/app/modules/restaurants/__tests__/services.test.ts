import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { restaurantsService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

describe('restaurantsService', () => {
  it('getAll on 200', async () => {
    server.use(http.get('/api/restaurants', () => HttpResponse.json([])))
    expect(await restaurantsService.getAll()).toEqual([])
  })

  it('getAll throws on 500', async () => {
    server.use(http.get('/api/restaurants', () => HttpResponse.json({}, { status: 500 })))
    await expect(restaurantsService.getAll()).rejects.toBeInstanceOf(HttpError)
  })

  it('getAll network failure', async () => {
    server.use(http.get('/api/restaurants', () => HttpResponse.error()))
    await expect(restaurantsService.getAll()).rejects.toBeTruthy()
  })

  it('getById on 200', async () => {
    server.use(http.get('/api/restaurants/:id', () => HttpResponse.json({ id: '1' })))
    expect(await restaurantsService.getById('1')).toEqual({ id: '1' })
  })

  it('getById throws on 404', async () => {
    server.use(http.get('/api/restaurants/:id', () => HttpResponse.json({}, { status: 404 })))
    await expect(restaurantsService.getById('1')).rejects.toBeInstanceOf(HttpError)
  })

  it('update on 200 sends patch body and returns the updated record', async () => {
    let receivedId: string | undefined
    let receivedBody: Record<string, unknown> | undefined
    server.use(
      http.put('/api/restaurants/:id', async ({ params, request }) => {
        receivedId = params.id as string
        receivedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: receivedId, ...receivedBody })
      }),
    )

    const result = await restaurantsService.update('42', { name: 'New Name' })

    expect(receivedId).toBe('42')
    expect(receivedBody).toEqual({ name: 'New Name' })
    expect(result).toEqual({ id: '42', name: 'New Name' })
  })

  it('update throws on 404', async () => {
    server.use(http.put('/api/restaurants/:id', () => HttpResponse.json({}, { status: 404 })))
    await expect(restaurantsService.update('1', { name: 'x' })).rejects.toBeInstanceOf(HttpError)
  })

  it('update network failure', async () => {
    server.use(http.put('/api/restaurants/:id', () => HttpResponse.error()))
    await expect(restaurantsService.update('1', { name: 'x' })).rejects.toBeTruthy()
  })
})
