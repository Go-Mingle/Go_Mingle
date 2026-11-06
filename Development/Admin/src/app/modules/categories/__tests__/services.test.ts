import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { categoriesService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

describe('categoriesService', () => {
  it('getAll returns categories on 200', async () => {
    server.use(http.get('/api/v1/categories', () => HttpResponse.json([{ id: '1', name: 'A' }])))
    const res = await categoriesService.getAll()
    expect(res).toHaveLength(1)
  })

  it('getAll returns the items array when the API responds with an envelope object', async () => {
    server.use(
      http.get('/api/v1/categories', () =>
        HttpResponse.json({
          items: [
            { id: '1', name: 'A' },
            { id: '2', name: 'B' },
          ],
        }),
      ),
    )
    const res = await categoriesService.getAll()
    expect(res).toHaveLength(2)
  })

  it('getAll returns an empty array when the envelope object has no items', async () => {
    server.use(http.get('/api/v1/categories', () => HttpResponse.json({})))
    const res = await categoriesService.getAll()
    expect(res).toEqual([])
  })

  it('getAll throws HttpError on 500', async () => {
    server.use(http.get('/api/v1/categories', () => HttpResponse.json({}, { status: 500 })))
    await expect(categoriesService.getAll()).rejects.toBeInstanceOf(HttpError)
  })

  it('getAll throws on network failure', async () => {
    server.use(http.get('/api/v1/categories', () => HttpResponse.error()))
    await expect(categoriesService.getAll()).rejects.toBeTruthy()
  })

  it('create returns category on 200', async () => {
    server.use(
      http.post('/api/v1/categories', async ({ request }) =>
        HttpResponse.json(await request.json()),
      ),
    )
    const r = await categoriesService.create({
      name: 'New',
      commissionRate: 5,
    })
    expect((r as { name: string }).name).toBe('New')
  })

  it('create throws HttpError on 400', async () => {
    server.use(http.post('/api/v1/categories', () => HttpResponse.json({}, { status: 400 })))
    await expect(
      categoriesService.create({
        name: '',
        commissionRate: 0,
      }),
    ).rejects.toBeInstanceOf(HttpError)
  })

  it('update returns category on 200', async () => {
    server.use(
      http.patch('/api/v1/categories/:id', async ({ request }) =>
        HttpResponse.json(await request.json()),
      ),
    )
    const r = await categoriesService.update('1', {
      name: 'Upd',
      commissionRate: 9,
    })
    expect((r as { name: string }).name).toBe('Upd')
  })

  it('update throws HttpError on 404', async () => {
    server.use(http.patch('/api/v1/categories/:id', () => HttpResponse.json({}, { status: 404 })))
    await expect(
      categoriesService.update('1', {
        name: 'X',
        commissionRate: 1,
      }),
    ).rejects.toBeInstanceOf(HttpError)
  })

  it('delete resolves on 204', async () => {
    server.use(http.delete('/api/v1/categories/:id', () => new HttpResponse(null, { status: 204 })))
    await expect(categoriesService.delete('1')).resolves.toBeUndefined()
  })

  it('delete throws on 500', async () => {
    server.use(http.delete('/api/v1/categories/:id', () => HttpResponse.json({}, { status: 500 })))
    await expect(categoriesService.delete('1')).rejects.toBeInstanceOf(HttpError)
  })

  it('getActive returns active categories on 200', async () => {
    server.use(
      http.get('/api/v1/categories/active', () =>
        HttpResponse.json([
          { id: '1', name: 'Active' },
          { id: '2', name: 'Also Active' },
        ]),
      ),
    )
    const res = await categoriesService.getActive()
    expect(res).toHaveLength(2)
    expect(res[0].name).toBe('Active')
  })

  it('getActive normalises the { items } envelope shape', async () => {
    server.use(
      http.get('/api/v1/categories/active', () =>
        HttpResponse.json({ success: true, data: { items: [{ id: '1', name: 'Active' }] } }),
      ),
    )
    const res = await categoriesService.getActive()
    expect(res).toHaveLength(1)
    expect(res[0].name).toBe('Active')
  })

  it('getActive throws HttpError on 500', async () => {
    server.use(http.get('/api/v1/categories/active', () => HttpResponse.json({}, { status: 500 })))
    await expect(categoriesService.getActive()).rejects.toBeInstanceOf(HttpError)
  })

  it('getActive throws on network failure', async () => {
    server.use(http.get('/api/v1/categories/active', () => HttpResponse.error()))
    await expect(categoriesService.getActive()).rejects.toBeTruthy()
  })

  it('getById returns category on 200', async () => {
    server.use(
      http.get('/api/v1/categories/:id', () =>
        HttpResponse.json({ id: '1', name: 'Test Category' }),
      ),
    )
    const res = await categoriesService.getById('1')
    expect(res.id).toBe('1')
    expect(res.name).toBe('Test Category')
  })

  it('getById throws HttpError on 404', async () => {
    server.use(http.get('/api/v1/categories/:id', () => HttpResponse.json({}, { status: 404 })))
    await expect(categoriesService.getById('1')).rejects.toBeInstanceOf(HttpError)
  })

  it('getById throws on network failure', async () => {
    server.use(http.get('/api/v1/categories/:id', () => HttpResponse.error()))
    await expect(categoriesService.getById('1')).rejects.toBeTruthy()
  })

  it('create throws on network failure', async () => {
    server.use(http.post('/api/v1/categories', () => HttpResponse.error()))
    await expect(
      categoriesService.create({
        name: 'New',
        commissionRate: 5,
      }),
    ).rejects.toBeTruthy()
  })

  it('update throws on network failure', async () => {
    server.use(http.patch('/api/v1/categories/:id', () => HttpResponse.error()))
    await expect(
      categoriesService.update('1', {
        name: 'Upd',
        commissionRate: 9,
      }),
    ).rejects.toBeTruthy()
  })

  it('delete throws on network failure', async () => {
    server.use(http.delete('/api/v1/categories/:id', () => HttpResponse.error()))
    await expect(categoriesService.delete('1')).rejects.toBeTruthy()
  })
})
