import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { usersService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

describe('usersService', () => {
  it('getAll on 200', async () => {
    server.use(
      http.get('/api/v1/users', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [{ id: '1' }],
            pagination: { page: 1, pageSize: 25, totalRecords: 1, totalPages: 1 },
          },
        }),
      ),
    )
    expect((await usersService.getAll()).items).toHaveLength(1)
  })

  it('getAll throws on 500', async () => {
    server.use(http.get('/api/v1/users', () => HttpResponse.json({}, { status: 500 })))
    await expect(usersService.getAll()).rejects.toBeInstanceOf(HttpError)
  })

  it('getAll network failure', async () => {
    server.use(http.get('/api/v1/users', () => HttpResponse.error()))
    await expect(usersService.getAll()).rejects.toBeTruthy()
  })

  it('create on 200', async () => {
    server.use(
      http.post('/api/v1/users', async ({ request }) => HttpResponse.json(await request.json())),
    )
    const r = await usersService.create({
      fullName: 'A',
      email: 'a@b.c',
      roleId: 'r1',
      password: 'pw',
      confirmPassword: 'pw',
    })
    expect((r as { fullName: string }).fullName).toBe('A')
  })

  it('create throws on 400', async () => {
    server.use(http.post('/api/v1/users', () => HttpResponse.json({}, { status: 400 })))
    await expect(
      usersService.create({
        fullName: '',
        email: '',
        roleId: '',
        password: '',
        confirmPassword: '',
      }),
    ).rejects.toBeInstanceOf(HttpError)
  })

  it('update on 200', async () => {
    server.use(
      http.patch('/api/v1/users/:id', async ({ request }) =>
        HttpResponse.json(await request.json()),
      ),
    )
    const r = await usersService.update('1', { fullName: 'U', roleId: 'r1', status: 'ACTIVE' })
    expect((r as { fullName: string }).fullName).toBe('U')
  })

  it('update throws on 404', async () => {
    server.use(http.patch('/api/v1/users/:id', () => HttpResponse.json({}, { status: 404 })))
    await expect(
      usersService.update('1', { fullName: '', roleId: '', status: 'ACTIVE' }),
    ).rejects.toBeInstanceOf(HttpError)
  })

  it('delete on 204', async () => {
    server.use(http.delete('/api/v1/users/:id', () => new HttpResponse(null, { status: 204 })))
    await expect(usersService.delete('1')).resolves.toBeUndefined()
  })

  it('delete throws on 500', async () => {
    server.use(http.delete('/api/v1/users/:id', () => HttpResponse.json({}, { status: 500 })))
    await expect(usersService.delete('1')).rejects.toBeInstanceOf(HttpError)
  })

  it('changePassword on 200', async () => {
    server.use(
      http.post('/api/v1/users/:id/change-password', () =>
        HttpResponse.json({
          success: true,
          data: { id: '1', email: 'a@b.c', passwordChangedAt: '2024-01-01T00:00:00.000Z' },
        }),
      ),
    )
    const r = await usersService.changePassword('1', {
      newPassword: 'StrongPass1!',
      confirmNewPassword: 'StrongPass1!',
    })
    expect(r.id).toBe('1')
  })

  it('changePassword throws on 503', async () => {
    server.use(
      http.post('/api/v1/users/:id/change-password', () => HttpResponse.json({}, { status: 503 })),
    )
    await expect(
      usersService.changePassword('1', { newPassword: 'x', confirmNewPassword: 'x' }),
    ).rejects.toBeInstanceOf(HttpError)
  })
})
