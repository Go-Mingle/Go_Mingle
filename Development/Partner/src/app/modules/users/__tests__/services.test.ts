import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { resetMockPartnerUsers } from '../../../../mocks/data/partnerUsers'
import { HttpError } from '../../../../shared/api/httpClient'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { PARTNER_USERS_ENDPOINTS } from '../constants'
import { partnerUsersService } from '../services'

const LIST = PARTNER_USERS_ENDPOINTS.list

beforeEach(() => {
  resetMockPartnerUsers()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('partnerUsersService.list', () => {
  it('unwraps the envelope into items and pagination', async () => {
    const page = await partnerUsersService.list()
    expect(page.items.length).toBeGreaterThan(0)
    expect(page.pagination.pageSize).toBe(25)
  })

  it('does not send a restaurant id — scope comes from the token', async () => {
    let seen = ''
    server.use(
      http.get(LIST, ({ request }) => {
        seen = new URL(request.url).search
        return HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 1, pageSize: 25, totalRecords: 0, totalPages: 1 },
          },
        })
      }),
    )
    await partnerUsersService.list({ page: 2, sortBy: 'name', sortOrder: 'desc' })
    expect(seen).toContain('page=2')
    expect(seen).toContain('sortBy=name')
    expect(seen).not.toContain('restaurantId')
  })

  it('passes the status filter as repeated keys', async () => {
    let seen: string[] = []
    server.use(
      http.get(LIST, ({ request }) => {
        seen = new URL(request.url).searchParams.getAll('status')
        return HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 1, pageSize: 25, totalRecords: 0, totalPages: 1 },
          },
        })
      }),
    )
    await partnerUsersService.list({ status: ['ACTIVE', 'SUSPENDED'] })
    expect(seen).toEqual(['ACTIVE', 'SUSPENDED'])
  })

  it('throws on a 400 from an inverted date range', async () => {
    await expect(
      partnerUsersService.list({ lastActiveFrom: '2026-06-01', lastActiveTo: '2026-01-01' }),
    ).rejects.toBeInstanceOf(HttpError)
  })

  it('throws on a 500', async () => {
    server.use(http.get(LIST, () => HttpResponse.json({}, { status: 500 })))
    await expect(partnerUsersService.list()).rejects.toBeInstanceOf(HttpError)
  })
})

describe('partnerUsersService.create', () => {
  const valid = {
    fullName: 'Nadia Rahman',
    email: 'nadia@aurelia.pk',
    designation: 'Marketing Lead',
    status: 'ACTIVE' as const,
    password: 'Aurelia2026!',
    confirmPassword: 'Aurelia2026!',
  }

  it('returns the created user including the email the grid omits', async () => {
    const created = await partnerUsersService.create(valid)
    expect(created.fullName).toBe('Nadia Rahman')
    expect(created.email).toBe('nadia@aurelia.pk')
    expect(created.isPrimary).toBe(false)
  })

  it('sends confirmPassword — unlike signup, which rejects the key', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(LIST, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ success: true, data: { id: 'x' } }, { status: 201 })
      }),
    )
    await partnerUsersService.create(valid)
    expect(body.confirmPassword).toBe('Aurelia2026!')
  })

  it('surfaces ERR_DUPLICATE_EMAIL as a 409 with its code intact', async () => {
    await expect(
      partnerUsersService.create({ ...valid, email: 'yasmeen@aurelia.pk' }),
    ).rejects.toMatchObject({ status: 409, code: 'ERR_DUPLICATE_EMAIL' })
  })

  it('revives a soft-deleted record rather than duplicating it (BR-12)', async () => {
    await partnerUsersService.remove('pu-3')
    const revived = await partnerUsersService.create({ ...valid, email: 'osama@aurelia.pk' })
    expect(revived.reactivated).toBe(true)
    expect(revived.id).toBe('pu-3')
  })

  it('throws 422 when the confirmation does not match', async () => {
    await expect(
      partnerUsersService.create({ ...valid, confirmPassword: 'Different1!' }),
    ).rejects.toMatchObject({ status: 422 })
  })
})

describe('partnerUsersService.update', () => {
  it('patches only the fields sent', async () => {
    const updated = await partnerUsersService.update('pu-2', { designation: 'Operations Lead' })
    expect(updated.designation).toBe('Operations Lead')
    expect(updated.fullName).toBe('Yasmeen Iqbal')
  })

  it('clears the designation with an empty string', async () => {
    const updated = await partnerUsersService.update('pu-2', { designation: '' })
    expect(updated.designation).toBeNull()
  })

  it('suspends via status — there is no separate endpoint (US-05)', async () => {
    const updated = await partnerUsersService.update('pu-2', { status: 'SUSPENDED' })
    expect(updated.status).toBe('SUSPENDED')
  })

  it('rejects suspending the primary user with ERR_FORBIDDEN_PRIMARY', async () => {
    await expect(partnerUsersService.update('pu-1', { status: 'SUSPENDED' })).rejects.toMatchObject(
      { status: 403, code: 'ERR_FORBIDDEN_PRIMARY' },
    )
  })

  it('still allows renaming the primary user', async () => {
    const updated = await partnerUsersService.update('pu-1', { fullName: 'Hira M. Mansoor' })
    expect(updated.fullName).toBe('Hira M. Mansoor')
  })

  it('404s for a user outside the caller scope', async () => {
    await expect(partnerUsersService.update('nope', { fullName: 'X' })).rejects.toMatchObject({
      status: 404,
    })
  })
})

describe('partnerUsersService.setPassword', () => {
  it('resolves with passwordSet', async () => {
    await expect(
      partnerUsersService.setPassword('pu-2', {
        password: 'Aurelia2026!',
        confirmPassword: 'Aurelia2026!',
      }),
    ).resolves.toEqual({ passwordSet: true })
  })

  it('works on the primary user, unlike suspend and delete (AC-01.3)', async () => {
    await expect(
      partnerUsersService.setPassword('pu-1', {
        password: 'Aurelia2026!',
        confirmPassword: 'Aurelia2026!',
      }),
    ).resolves.toEqual({ passwordSet: true })
  })

  it('throws 422 on a mismatch', async () => {
    await expect(
      partnerUsersService.setPassword('pu-2', { password: 'a', confirmPassword: 'b' }),
    ).rejects.toMatchObject({ status: 422 })
  })
})

describe('partnerUsersService.remove', () => {
  it('soft-deletes and drops the row from the list', async () => {
    await expect(partnerUsersService.remove('pu-2')).resolves.toEqual({ deleted: true })
    const page = await partnerUsersService.list()
    expect(page.items.map((u) => u.id)).not.toContain('pu-2')
  })

  it('rejects the primary user with ERR_FORBIDDEN_PRIMARY', async () => {
    await expect(partnerUsersService.remove('pu-1')).rejects.toMatchObject({
      status: 403,
      code: 'ERR_FORBIDDEN_PRIMARY',
    })
  })

  it('404s on a second delete of the same row', async () => {
    await partnerUsersService.remove('pu-2')
    await expect(partnerUsersService.remove('pu-2')).rejects.toMatchObject({ status: 404 })
  })
})
