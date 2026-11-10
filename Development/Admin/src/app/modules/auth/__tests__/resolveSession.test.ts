import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { resolveMeWithPermissions } from '../resolveSession'

const meResponse = {
  id: 'u1',
  email: 'a@b.c',
  fullName: 'Admin User',
  role: {
    id: 'r3',
    name: 'Finance Manager',
    permissions: ['FINANCES', 'CHANGE_LOG'],
    fullAccess: false,
  },
  status: 'ACTIVE',
  createdAt: '2026-01-15T08:30:00Z',
}

describe('resolveMeWithPermissions', () => {
  it('resolves identity and permissions from auth/me without calling roles/{id}', async () => {
    const rolesSpy = vi.fn()
    server.use(
      http.get('/api/v1/auth/me', () => HttpResponse.json(meResponse)),
      http.get('/api/v1/roles/:id', ({ params }) => {
        rolesSpy()
        return HttpResponse.json({ success: true, data: { id: params.id } })
      }),
    )

    const result = await resolveMeWithPermissions()
    expect(result.me.id).toBe('u1')
    expect(result.me.role.id).toBe('r3')
    expect(result.permissions).toEqual(['FINANCES', 'CHANGE_LOG'])
    expect(result.fullAccess).toBe(false)
    // The redundant roles/{id} lookup must no longer be made.
    expect(rolesSpy).not.toHaveBeenCalled()
  })

  it('degrades to no permissions when auth/me omits permissions/fullAccess', async () => {
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json({
          id: 'u1',
          email: 'a@b.c',
          fullName: 'Admin User',
          role: { id: 'r3', name: 'Finance Manager' },
          status: 'ACTIVE',
          createdAt: '2026-01-15T08:30:00Z',
        }),
      ),
    )

    const result = await resolveMeWithPermissions()
    expect(result.me.id).toBe('u1')
    expect(result.permissions).toEqual([])
    expect(result.fullAccess).toBe(false)
  })

  it('propagates the error when auth/me fails', async () => {
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json({ error: { code: 'ERR_UNAUTHORIZED' } }, { status: 401 }),
      ),
    )

    await expect(resolveMeWithPermissions()).rejects.toBeTruthy()
  })
})
