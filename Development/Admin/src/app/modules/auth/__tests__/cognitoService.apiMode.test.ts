/**
 * Backend (API) auth mode — admins sign in against the GoMingle API instead of
 * Cognito. The public functions keep their Cognito-era contracts, so these tests
 * assert the same shapes and error codes the login screen already relies on.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'

const env = vi.hoisted(() => ({
  ENV: {
    API_BASE_URL: 'https://api.gomingle.test/admin',
    AWS_REGION: '',
    COGNITO_CLIENT_ID: '',
    AUTH_MODE: 'api',
  },
}))
vi.mock('../../../../configs/env', () => env)

const mocks = vi.hoisted(() => ({ enabled: true }))
vi.mock('../../../../shared/api/mocksEnabled', () => ({ isMocksEnabled: () => mocks.enabled }))

const send = vi.fn()
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: class {
    send = send
  },
  InitiateAuthCommand: class {},
  GetUserCommand: class {},
  GlobalSignOutCommand: class {},
}))

const { cognitoLogin, cognitoSignOut, refreshAccessToken, isApiAuthMode, mapCognitoErrorToCode } =
  await import('../cognitoService')

async function loginError(email: string, password: string): Promise<string> {
  try {
    await cognitoLogin(email, password)
  } catch (err) {
    return mapCognitoErrorToCode(err)
  }
  throw new Error('expected login to fail')
}

beforeEach(() => {
  localStorage.clear()
  send.mockReset()
  env.ENV.AUTH_MODE = 'api'
  env.ENV.AWS_REGION = ''
  env.ENV.COGNITO_CLIENT_ID = ''
  mocks.enabled = true
})

afterEach(() => {
  server.resetHandlers()
})

describe('isApiAuthMode', () => {
  it('honours an explicit mode', () => {
    env.ENV.AUTH_MODE = 'api'
    expect(isApiAuthMode()).toBe(true)
    env.ENV.AUTH_MODE = 'cognito'
    expect(isApiAuthMode()).toBe(false)
  })

  it('falls back to the backend only when no Cognito pool is configured', () => {
    env.ENV.AUTH_MODE = ''
    expect(isApiAuthMode()).toBe(true)
    env.ENV.AWS_REGION = 'me-central-1'
    env.ENV.COGNITO_CLIENT_ID = 'client'
    expect(isApiAuthMode()).toBe(false)
  })
})

describe('cognitoLogin in API mode', () => {
  it('signs in with the demo admin, stores both tokens and never calls Cognito', async () => {
    const result = await cognitoLogin('admin@gomingle.com', 'Admin@123')

    expect(result.accessToken).toBe('mock-access-token')
    expect(result.user).toMatchObject({
      id: 'u-default-1',
      email: 'admin@gomingle.com',
      name: 'Hira Mansoor',
      initials: 'HI',
      permissions: [],
    })
    expect(localStorage.getItem('auth-token')).toBe('mock-access-token')
    expect(localStorage.getItem('auth-refresh-token')).toBe('mock-refresh-token')
    expect(send).not.toHaveBeenCalled()
  })

  it('maps a wrong password to ERR_INVALID_CREDENTIALS', async () => {
    expect(await loginError('admin@gomingle.com', 'wrong')).toBe('ERR_INVALID_CREDENTIALS')
  })

  it('maps a locked account to ERR_ACCOUNT_LOCKED', async () => {
    server.use(
      http.post('/api/v1/auth/login', () =>
        HttpResponse.json({ error: { code: 'ERR_ACCOUNT_LOCKED' } }, { status: 423 }),
      ),
    )
    expect(await loginError('admin@gomingle.com', 'Admin@123')).toBe('ERR_ACCOUNT_LOCKED')
  })

  it('maps rate limiting to ERR_TOO_MANY_ATTEMPTS', async () => {
    server.use(http.post('/api/v1/auth/login', () => HttpResponse.json({}, { status: 429 })))
    expect(await loginError('admin@gomingle.com', 'Admin@123')).toBe('ERR_TOO_MANY_ATTEMPTS')
  })

  it('maps a password-reset requirement', async () => {
    server.use(
      http.post('/api/v1/auth/login', () =>
        HttpResponse.json({ error: { code: 'ERR_PASSWORD_RESET_REQUIRED' } }, { status: 400 }),
      ),
    )
    expect(await loginError('admin@gomingle.com', 'Admin@123')).toBe('ERR_PASSWORD_RESET_REQUIRED')
  })

  it('treats a server or network failure as the service being unavailable', async () => {
    server.use(http.post('/api/v1/auth/login', () => new HttpResponse('oops', { status: 500 })))
    expect(await loginError('admin@gomingle.com', 'Admin@123')).toBe('ERR_COGNITO_UNAVAILABLE')

    server.use(http.post('/api/v1/auth/login', () => HttpResponse.error()))
    expect(await loginError('admin@gomingle.com', 'Admin@123')).toBe('ERR_COGNITO_UNAVAILABLE')
  })

  it('falls back to the login email when the response has no user', async () => {
    server.use(
      http.post('/api/v1/auth/login', () => HttpResponse.json({ accessToken: 'only-access' })),
    )
    const result = await cognitoLogin('ops@gomingle.com', 'x')
    expect(result.user).toMatchObject({
      id: '',
      email: 'ops@gomingle.com',
      name: 'ops@gomingle.com',
    })
    expect(localStorage.getItem('auth-refresh-token')).toBeNull()
  })

  it('calls the configured API host when mocks are off', async () => {
    mocks.enabled = false
    let calledUrl = ''
    server.use(
      http.post('https://api.gomingle.test/admin/api/v1/auth/login', ({ request }) => {
        calledUrl = request.url
        return HttpResponse.json({ accessToken: 'host-token', refreshToken: 'host-refresh' })
      }),
    )
    await cognitoLogin('admin@gomingle.com', 'Admin@123')
    expect(calledUrl).toBe('https://api.gomingle.test/admin/api/v1/auth/login')
  })
})

describe('refreshAccessToken in API mode', () => {
  it('exchanges the stored refresh token and stores the rotated pair', async () => {
    localStorage.setItem('auth-refresh-token', 'old-refresh')
    server.use(
      http.post('/api/v1/auth/refresh', async ({ request }) => {
        const body = (await request.json()) as { refreshToken: string }
        expect(body.refreshToken).toBe('old-refresh')
        return HttpResponse.json({ accessToken: 'new-access', refreshToken: 'new-refresh' })
      }),
    )
    await expect(refreshAccessToken()).resolves.toBe('new-access')
    expect(localStorage.getItem('auth-token')).toBe('new-access')
    expect(localStorage.getItem('auth-refresh-token')).toBe('new-refresh')
    expect(localStorage.getItem('auth-token-timestamp')).not.toBeNull()
  })

  it('keeps the refresh token when the server does not rotate it', async () => {
    localStorage.setItem('auth-refresh-token', 'keep-me')
    server.use(http.post('/api/v1/auth/refresh', () => HttpResponse.json({ accessToken: 'a2' })))
    await refreshAccessToken()
    expect(localStorage.getItem('auth-refresh-token')).toBe('keep-me')
  })

  it('rejects when the exchange is refused', async () => {
    localStorage.setItem('auth-refresh-token', 'dead')
    server.use(
      http.post('/api/v1/auth/refresh', () =>
        HttpResponse.json({ error: { code: 'ERR_REFRESH_INVALID' } }, { status: 401 }),
      ),
    )
    await expect(refreshAccessToken()).rejects.toThrow()
  })
})

describe('cognitoSignOut in API mode', () => {
  it('posts to the logout endpoint with the bearer token', async () => {
    let auth: string | null = null
    server.use(
      http.post('/api/v1/auth/logout', ({ request }) => {
        auth = request.headers.get('Authorization')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await cognitoSignOut('token-123')
    expect(auth).toBe('Bearer token-123')
    expect(send).not.toHaveBeenCalled()
  })
})
