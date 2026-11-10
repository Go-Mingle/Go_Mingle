import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { rolesService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

describe('rolesService', () => {
  it('getAll on 200', async () => {
    server.use(
      http.get('/api/v1/roles', () =>
        HttpResponse.json({
          items: [{ id: '1', name: 'A' }],
          pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
        }),
      ),
    )
    const result = await rolesService.getAll()
    expect(result.items).toHaveLength(1)
  })

  it('getAll throws on 500', async () => {
    server.use(http.get('/api/v1/roles', () => HttpResponse.json({}, { status: 500 })))
    await expect(rolesService.getAll()).rejects.toBeInstanceOf(HttpError)
  })

  it('getAll throws on network error', async () => {
    server.use(http.get('/api/v1/roles', () => HttpResponse.error()))
    await expect(rolesService.getAll()).rejects.toBeTruthy()
  })

  it('create on 200', async () => {
    server.use(
      http.post('/api/v1/roles', async ({ request }) => HttpResponse.json(await request.json())),
    )
    const r = await rolesService.create({ name: 'N', fullAccess: false, permissions: ['a'] })
    expect((r as { name: string }).name).toBe('N')
  })

  it('create throws on 400', async () => {
    server.use(http.post('/api/v1/roles', () => HttpResponse.json({}, { status: 400 })))
    await expect(
      rolesService.create({ name: '', fullAccess: false, permissions: [] }),
    ).rejects.toBeInstanceOf(HttpError)
  })

  it('update on 200', async () => {
    server.use(
      http.patch('/api/v1/roles/:id', async ({ request }) =>
        HttpResponse.json(await request.json()),
      ),
    )
    const r = await rolesService.update('1', { name: 'U', fullAccess: true, permissions: [] })
    expect((r as { name: string }).name).toBe('U')
  })

  it('update throws on 404', async () => {
    server.use(http.patch('/api/v1/roles/:id', () => HttpResponse.json({}, { status: 404 })))
    await expect(
      rolesService.update('1', { name: 'X', fullAccess: false, permissions: [] }),
    ).rejects.toBeInstanceOf(HttpError)
  })

  it('delete resolves on 204', async () => {
    server.use(http.delete('/api/v1/roles/:id', () => new HttpResponse(null, { status: 204 })))
    await expect(rolesService.delete('1')).resolves.toBeUndefined()
  })

  it('delete throws on 500', async () => {
    server.use(http.delete('/api/v1/roles/:id', () => HttpResponse.json({}, { status: 500 })))
    await expect(rolesService.delete('1')).rejects.toBeInstanceOf(HttpError)
  })

  it('getAll passes page and pageSize as query params', async () => {
    let capturedUrl = ''
    server.use(
      http.get('/api/v1/roles', ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          items: [],
          pagination: { page: 2, pageSize: 10, totalItems: 0, totalPages: 0 },
        })
      }),
    )
    await rolesService.getAll({ page: 2, pageSize: 10 })
    expect(capturedUrl).toContain('page=2')
    expect(capturedUrl).toContain('pageSize=10')
  })

  it('getAll passes sortBy, sortDir and search as query params', async () => {
    let capturedUrl = ''
    server.use(
      http.get('/api/v1/roles', ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          items: [],
          pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
        })
      }),
    )
    await rolesService.getAll({ search: 'manager', sortBy: 'usersAssigned', sortDir: 'desc' })
    expect(capturedUrl).toContain('search=manager')
    expect(capturedUrl).toContain('sortBy=usersAssigned')
    expect(capturedUrl).toContain('sortDir=desc')
  })

  it('getPermissionKeys unwraps the { success, data } envelope into a sectioned catalogue', async () => {
    server.use(
      http.get('/api/v1/roles/permission-keys', () =>
        HttpResponse.json({
          success: true,
          data: {
            sections: [
              { section: 'Configure', permissions: [{ key: 'USERS', label: 'User Management' }] },
            ],
          },
        }),
      ),
    )
    const result = await rolesService.getPermissionKeys()
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].section).toBe('Configure')
    expect(result.sections[0].permissions[0]).toEqual({ key: 'USERS', label: 'User Management' })
  })

  it('create sends permissions key not modules', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post('/api/v1/roles', async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(
          { id: '1', name: 'X', fullAccess: false, permissions: ['USERS'], usersAssigned: 0 },
          { status: 201 },
        )
      }),
    )
    await rolesService.create({ name: 'X', fullAccess: false, permissions: ['USERS'] })
    expect((capturedBody as Record<string, unknown>).permissions).toBeDefined()
    expect((capturedBody as Record<string, unknown>).modules).toBeUndefined()
  })

  it('delete throws HttpError with ERR_ROLE_HAS_ASSIGNED_USERS on 422', async () => {
    server.use(
      http.delete('/api/v1/roles/:id', () =>
        HttpResponse.json({ error: { code: 'ERR_ROLE_HAS_ASSIGNED_USERS' } }, { status: 422 }),
      ),
    )
    const err = await rolesService.delete('1').catch((e) => e)
    expect(err).toBeInstanceOf(HttpError)
    expect(err.code).toBe('ERR_ROLE_HAS_ASSIGNED_USERS')
  })

  it('update throws HttpError with ERR_LAST_SUPER_ADMIN_FULL_ACCESS_REQUIRED on 422', async () => {
    server.use(
      http.patch('/api/v1/roles/:id', () =>
        HttpResponse.json(
          { error: { code: 'ERR_LAST_SUPER_ADMIN_FULL_ACCESS_REQUIRED' } },
          { status: 422 },
        ),
      ),
    )
    const err = await rolesService.update('1', { fullAccess: false }).catch((e) => e)
    expect(err).toBeInstanceOf(HttpError)
    expect(err.code).toBe('ERR_LAST_SUPER_ADMIN_FULL_ACCESS_REQUIRED')
  })
})
