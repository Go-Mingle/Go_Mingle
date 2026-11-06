import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { authService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

const user = { id: '1', name: 'A', email: 'a@b.c', role: 'admin', initials: 'A' }

describe('authService', () => {
  it('login on 200', async () => {
    server.use(http.post('/api/auth/login', () => HttpResponse.json({ token: 't', user })))
    const r = await authService.login({ email: 'a@b.c', password: 'p' })
    expect(r.token).toBe('t')
  })

  it('login throws on 401', async () => {
    server.use(http.post('/api/auth/login', () => HttpResponse.json({}, { status: 401 })))
    await expect(authService.login({ email: 'x', password: 'y' })).rejects.toBeInstanceOf(HttpError)
  })

  it('login throws on network failure', async () => {
    server.use(http.post('/api/auth/login', () => HttpResponse.error()))
    await expect(authService.login({ email: '', password: '' })).rejects.toBeTruthy()
  })

  it('requestOtp resolves on 204', async () => {
    server.use(http.post('/api/auth/otp/request', () => new HttpResponse(null, { status: 204 })))
    await expect(authService.requestOtp({ email: 'a@b.c' })).resolves.toBeUndefined()
  })

  it('requestOtp throws on 500', async () => {
    server.use(http.post('/api/auth/otp/request', () => HttpResponse.json({}, { status: 500 })))
    await expect(authService.requestOtp({ email: 'a@b.c' })).rejects.toBeInstanceOf(HttpError)
  })

  it('verifyOtp returns token on 200', async () => {
    server.use(http.post('/api/auth/otp/verify', () => HttpResponse.json({ token: 'jwt', user })))
    const r = await authService.verifyOtp({ email: 'a@b.c', otp: '123456' })
    expect(r.token).toBe('jwt')
  })

  it('verifyOtp throws on 400', async () => {
    server.use(http.post('/api/auth/otp/verify', () => HttpResponse.json({}, { status: 400 })))
    await expect(authService.verifyOtp({ email: 'a@b.c', otp: '0' })).rejects.toBeInstanceOf(
      HttpError,
    )
  })

  it('logout resolves on 204', async () => {
    server.use(http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })))
    await expect(authService.logout()).resolves.toBeUndefined()
  })

  it('logout throws on 500', async () => {
    server.use(http.post('/api/auth/logout', () => HttpResponse.json({}, { status: 500 })))
    await expect(authService.logout()).rejects.toBeInstanceOf(HttpError)
  })
})
