import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../mocks/server'
import { AuthError } from '../authError'
import { apiAuthProvider, PARTNER_AUTH_ENDPOINTS as E } from '../apiAuthProvider'
import { tokenStore } from '../tokenStore'

const USER = { id: 'u1', email: 'partner@gomingle.com', fullName: 'Hira Mansoor' }

function codeOf(error: unknown): string | undefined {
  return error instanceof AuthError ? error.code : undefined
}

beforeEach(() => {
  tokenStore.clear()
})

describe('apiAuthProvider.signIn', () => {
  it('stores the session the backend issues and returns the identity', async () => {
    let sent: unknown
    server.use(
      http.post(E.login, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({
          accessToken: 'jwt-access',
          refreshToken: 'opaque-refresh',
          expiresIn: 7200,
          user: USER,
        })
      }),
    )

    const identity = await apiAuthProvider.signIn('  Partner@GoMingle.com ', 'Partner@123')

    expect(sent).toEqual({ email: 'partner@gomingle.com', password: 'Partner@123' })
    expect(identity).toEqual(USER)
    expect(tokenStore.getAccessToken()).toBe('jwt-access')
    expect(tokenStore.getRefreshToken()).toBe('opaque-refresh')
    expect(tokenStore.getExpiresAt()).toBeGreaterThan(Date.now() + 7_000_000)
    expect(apiAuthProvider.getAccessToken()).toBe('jwt-access')
    expect(apiAuthProvider.getIdentity()).toEqual(USER)
  })

  it('maps the backend error code onto AuthError', async () => {
    server.use(
      http.post(E.login, () =>
        HttpResponse.json({ error: { code: 'INVALID_CREDENTIALS' } }, { status: 401 }),
      ),
    )
    const error = await apiAuthProvider.signIn('a@b.pk', 'x').catch((e: unknown) => e)
    expect(codeOf(error)).toBe('INVALID_CREDENTIALS')
    expect(tokenStore.getAccessToken()).toBeNull()
  })

  it('shows lockout copy from the server verbatim', async () => {
    server.use(
      http.post(E.login, () =>
        HttpResponse.json(
          { error: { code: 'PRE_AUTH_REJECTED', message: 'Locked for 15 minutes.' } },
          { status: 403 },
        ),
      ),
    )
    const error = await apiAuthProvider.signIn('a@b.pk', 'x').catch((e: unknown) => e)
    expect(codeOf(error)).toBe('PRE_AUTH_REJECTED')
    expect((error as Error).message).toBe('Locked for 15 minutes.')
  })

  it('reports unknown 4xx as UNKNOWN, 5xx and network failures as NETWORK', async () => {
    server.use(http.post(E.login, () => HttpResponse.json({}, { status: 418 })))
    expect(codeOf(await apiAuthProvider.signIn('a@b.pk', 'x').catch((e: unknown) => e))).toBe(
      'UNKNOWN',
    )

    server.use(http.post(E.login, () => new HttpResponse('down', { status: 503 })))
    expect(codeOf(await apiAuthProvider.signIn('a@b.pk', 'x').catch((e: unknown) => e))).toBe(
      'NETWORK',
    )

    server.use(http.post(E.login, () => HttpResponse.error()))
    expect(codeOf(await apiAuthProvider.signIn('a@b.pk', 'x').catch((e: unknown) => e))).toBe(
      'NETWORK',
    )
  })

  it('refuses a session without a refresh token or user', async () => {
    server.use(http.post(E.login, () => HttpResponse.json({ accessToken: 'only' })))
    const error = await apiAuthProvider.signIn('a@b.pk', 'x').catch((e: unknown) => e)
    expect(codeOf(error)).toBe('UNKNOWN')
  })
})

describe('apiAuthProvider.refresh', () => {
  it('fails fast without a stored refresh token', async () => {
    const error = await apiAuthProvider.refresh().catch((e: unknown) => e)
    expect(codeOf(error)).toBe('REFRESH_FAILED')
  })

  it('swaps in the new access token', async () => {
    tokenStore.setTokens({ accessToken: 'a1', refreshToken: 'r1', expiresAt: Date.now() })
    server.use(http.post(E.refresh, () => HttpResponse.json({ accessToken: 'a2' })))
    await expect(apiAuthProvider.refresh()).resolves.toBe('a2')
    expect(tokenStore.getAccessToken()).toBe('a2')
  })

  it('reports a refused exchange as REFRESH_FAILED', async () => {
    tokenStore.setTokens({ accessToken: 'a1', refreshToken: 'r1', expiresAt: Date.now() })
    server.use(
      http.post(E.refresh, () =>
        HttpResponse.json({ error: { code: 'REFRESH_FAILED' } }, { status: 401 }),
      ),
    )
    const error = await apiAuthProvider.refresh().catch((e: unknown) => e)
    expect(codeOf(error)).toBe('REFRESH_FAILED')
  })
})

describe('apiAuthProvider.signOut', () => {
  it('clears the session and tells the backend', async () => {
    tokenStore.setTokens({ accessToken: 'a1', refreshToken: 'r1', expiresAt: Date.now() })
    const logout = vi.fn()
    server.use(
      http.post(E.logout, ({ request }) => {
        logout(request.headers.get('Authorization'))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await apiAuthProvider.signOut()
    expect(tokenStore.getAccessToken()).toBeNull()
    expect(logout).toHaveBeenCalledWith('Bearer a1')
  })

  it('still signs out locally when the backend is unreachable or there is no session', async () => {
    tokenStore.setTokens({ accessToken: 'a1', refreshToken: 'r1', expiresAt: Date.now() })
    server.use(http.post(E.logout, () => HttpResponse.error()))
    await expect(apiAuthProvider.signOut()).resolves.toBeUndefined()
    expect(tokenStore.getAccessToken()).toBeNull()
    await expect(apiAuthProvider.signOut()).resolves.toBeUndefined()
  })
})

describe('apiAuthProvider password flows', () => {
  it('requests a reset code for the normalised address', async () => {
    let sent: unknown
    server.use(
      http.post(E.forgotPassword, async ({ request }) => {
        sent = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await apiAuthProvider.forgotPassword(' Owner@Kolachi.PK ')
    expect(sent).toEqual({ email: 'owner@kolachi.pk' })
  })

  it('confirms a reset and surfaces a wrong code', async () => {
    server.use(http.post(E.confirmForgotPassword, () => new HttpResponse(null, { status: 204 })))
    await expect(
      apiAuthProvider.confirmForgotPassword('a@b.pk', '123456', 'Karachi@2026'),
    ).resolves.toBeUndefined()

    server.use(
      http.post(E.confirmForgotPassword, () =>
        HttpResponse.json({ error: { code: 'CODE_MISMATCH' } }, { status: 400 }),
      ),
    )
    const error = await apiAuthProvider
      .confirmForgotPassword('a@b.pk', '000000', 'Karachi@2026')
      .catch((e: unknown) => e)
    expect(codeOf(error)).toBe('CODE_MISMATCH')
  })

  it('changes the password with the bearer token', async () => {
    tokenStore.setTokens({ accessToken: 'a1', refreshToken: 'r1', expiresAt: Date.now() })
    let auth: string | null = null
    server.use(
      http.post(E.changePassword, ({ request }) => {
        auth = request.headers.get('Authorization')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await apiAuthProvider.changePassword('Old@12345', 'New@12345')
    expect(auth).toBe('Bearer a1')
  })

  it('rejects reusing the current password without a request', async () => {
    const error = await apiAuthProvider
      .changePassword('Same@12345', 'Same@12345')
      .catch((e: unknown) => e)
    expect(codeOf(error)).toBe('SAME_PASSWORD')
  })
})
