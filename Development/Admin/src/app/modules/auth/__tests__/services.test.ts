import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { authService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

const user = { id: '1', name: 'A', email: 'a@b.c', role: 'admin', initials: 'A' }

describe('authService', () => {
  it('login on 200', async () => {
    server.use(http.post('/api/v1/auth/login', () => HttpResponse.json({ token: 't', user })))
    const r = await authService.login({ email: 'a@b.c', password: 'p' })
    expect(r.token).toBe('t')
  })

  it('login throws on 401', async () => {
    server.use(http.post('/api/v1/auth/login', () => HttpResponse.json({}, { status: 401 })))
    await expect(authService.login({ email: 'x', password: 'y' })).rejects.toBeInstanceOf(HttpError)
  })

  it('login throws on network failure', async () => {
    server.use(http.post('/api/v1/auth/login', () => HttpResponse.error()))
    await expect(authService.login({ email: '', password: '' })).rejects.toBeTruthy()
  })

  it('requestOtp resolves on 204', async () => {
    server.use(http.post('/api/v1/auth/otp/request', () => new HttpResponse(null, { status: 204 })))
    await expect(authService.requestOtp({ email: 'a@b.c' })).resolves.toBeUndefined()
  })

  it('requestOtp throws on 500', async () => {
    server.use(http.post('/api/v1/auth/otp/request', () => HttpResponse.json({}, { status: 500 })))
    await expect(authService.requestOtp({ email: 'a@b.c' })).rejects.toBeInstanceOf(HttpError)
  })

  it('verifyOtp returns token on 200', async () => {
    server.use(
      http.post('/api/v1/auth/otp/verify', () => HttpResponse.json({ token: 'jwt', user })),
    )
    const r = await authService.verifyOtp({ email: 'a@b.c', otp: '123456' })
    expect(r.token).toBe('jwt')
  })

  it('verifyOtp throws on 400', async () => {
    server.use(http.post('/api/v1/auth/otp/verify', () => HttpResponse.json({}, { status: 400 })))
    await expect(authService.verifyOtp({ email: 'a@b.c', otp: '0' })).rejects.toBeInstanceOf(
      HttpError,
    )
  })

  it('forgotPasswordRequestCode resolves on 200', async () => {
    server.use(
      http.post('/api/v1/auth/forgot-password/request-code', () =>
        HttpResponse.json({ codeSentAt: '2024-01-01T00:00:00.000Z' }),
      ),
    )
    await expect(authService.forgotPasswordRequestCode('a@b.c')).resolves.toBeDefined()
  })

  it('forgotPasswordRequestCode throws HttpError on 500', async () => {
    server.use(
      http.post('/api/v1/auth/forgot-password/request-code', () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    )
    await expect(authService.forgotPasswordRequestCode('a@b.c')).rejects.toBeInstanceOf(HttpError)
  })

  it('forgotPasswordVerifyCode returns resetSessionToken on 200', async () => {
    server.use(
      http.post('/api/v1/auth/forgot-password/verify-code', () =>
        HttpResponse.json({ resetSessionToken: 'test-reset-token' }),
      ),
    )
    const result = await authService.forgotPasswordVerifyCode('a@b.c', '123456')
    expect(result.resetSessionToken).toBe('test-reset-token')
  })

  it('forgotPasswordVerifyCode throws HttpError with code ERR_INVALID_CODE on 400', async () => {
    server.use(
      http.post('/api/v1/auth/forgot-password/verify-code', () =>
        HttpResponse.json({ error: { code: 'ERR_INVALID_CODE' } }, { status: 400 }),
      ),
    )
    await expect(authService.forgotPasswordVerifyCode('a@b.c', 'wrong')).rejects.toMatchObject({
      code: 'ERR_INVALID_CODE',
    })
  })

  it('forgotPasswordReset resolves on 200', async () => {
    server.use(http.post('/api/v1/auth/forgot-password/reset', () => HttpResponse.json({})))
    await expect(
      authService.forgotPasswordReset('reset-token', 'NewP@ss12', 'NewP@ss12'),
    ).resolves.toBeDefined()
  })

  it('forgotPasswordReset throws HttpError with code ERR_INVALID_RESET_TOKEN on 401', async () => {
    server.use(
      http.post('/api/v1/auth/forgot-password/reset', () =>
        HttpResponse.json({ error: { code: 'ERR_INVALID_RESET_TOKEN' } }, { status: 401 }),
      ),
    )
    await expect(
      authService.forgotPasswordReset('bad-token', 'NewP@ss12', 'NewP@ss12'),
    ).rejects.toMatchObject({ code: 'ERR_INVALID_RESET_TOKEN' })
  })

  it('getMe returns identity + role (incl. permissions/fullAccess) from auth/me on 200', async () => {
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json({
          id: '1',
          email: 'a@b.c',
          fullName: 'Admin User',
          role: { id: 'r1', name: 'Admin', permissions: ['USERS', 'CATEGORIES'], fullAccess: true },
          status: 'ACTIVE',
          createdAt: '21-05-2026 18:30',
        }),
      ),
    )
    const r = await authService.getMe()
    expect(r.id).toBe('1')
    expect(r.email).toBe('a@b.c')
    expect(r.role.id).toBe('r1')
    expect(r.role.name).toBe('Admin')
    expect(r.role.permissions).toEqual(['USERS', 'CATEGORIES'])
    expect(r.role.fullAccess).toBe(true)
  })

  it('getMe throws HttpError on network failure', async () => {
    server.use(http.get('/api/v1/auth/me', () => HttpResponse.error()))
    await expect(authService.getMe()).rejects.toBeTruthy()
  })

  it('changePassword resolves on 204', async () => {
    server.use(
      http.post('/api/v1/auth/change-password', () => new HttpResponse(null, { status: 204 })),
    )
    await expect(
      authService.changePassword({
        currentPassword: 'old',
        newPassword: 'new',
        confirmPassword: 'new',
      }),
    ).resolves.toBeUndefined()
  })

  it('changePassword throws HttpError on 400', async () => {
    server.use(
      http.post('/api/v1/auth/change-password', () => HttpResponse.json({}, { status: 400 })),
    )
    await expect(
      authService.changePassword({
        currentPassword: 'old',
        newPassword: 'new',
        confirmPassword: 'new',
      }),
    ).rejects.toBeInstanceOf(HttpError)
  })

  it('updateProfile resolves on 204', async () => {
    server.use(http.patch('/api/v1/auth/me', () => new HttpResponse(null, { status: 204 })))
    await expect(authService.updateProfile({ fullName: 'Updated' })).resolves.toBeUndefined()
  })

  it('updateProfile throws HttpError on 500', async () => {
    server.use(http.patch('/api/v1/auth/me', () => HttpResponse.json({}, { status: 500 })))
    await expect(authService.updateProfile({ fullName: 'Updated' })).rejects.toBeInstanceOf(
      HttpError,
    )
  })

  it('recordLoginResult success path returns attempt info', async () => {
    server.use(
      http.post('/api/v1/auth/record-login-result', () =>
        HttpResponse.json({ locked: false, remainingAttempts: 5 }),
      ),
    )
    const r = await authService.recordLoginResult({ email: 'a@b.c', succeeded: true })
    expect(r.locked).toBe(false)
    expect(r.remainingAttempts).toBe(5)
  })

  it('recordLoginResult throws HttpError on error', async () => {
    server.use(
      http.post('/api/v1/auth/record-login-result', () => HttpResponse.json({}, { status: 500 })),
    )
    await expect(
      authService.recordLoginResult({ email: 'a@b.c', succeeded: false }),
    ).rejects.toBeInstanceOf(HttpError)
  })
})
