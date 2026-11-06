import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../mocks/server'
import { httpClient, HttpError } from '../httpClient'
import { store } from '../../store/store'
import { loginAction } from '../../store/authSlice'

const UNAUTH_URL = '/api/v1/session-guarded'

const authUser = {
  id: 'u1',
  name: 'Test User',
  email: 'test@gomingle.com',
  role: 'Super Admin',
  permissions: [],
  fullAccess: true,
  initials: 'TU',
}

const originalLocation = window.location

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  // Replace window.location with a spyable stand-in on a non-/login path so the
  // hard redirect branch is exercised.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, assign: vi.fn(), pathname: '/restaurants' },
  })
})

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
})

describe('httpClient global 401 handling', () => {
  it('terminates the session and hard-redirects to /login on a 401 when a token exists', async () => {
    localStorage.setItem('auth-token', 'revoked-token')
    store.dispatch(loginAction(authUser))
    expect(store.getState().auth.isAuthenticated).toBe(true)

    server.use(
      http.get(UNAUTH_URL, () =>
        HttpResponse.json({ error: { code: 'ERR_UNAUTHENTICATED' } }, { status: 401 }),
      ),
    )

    await expect(httpClient.get(UNAUTH_URL)).rejects.toBeInstanceOf(HttpError)

    expect(store.getState().auth.isAuthenticated).toBe(false)
    expect(localStorage.getItem('auth-token')).toBeNull()
    expect(window.location.assign).toHaveBeenCalledWith('/login')
  })

  it('does not redirect on a 401 when there is no session token', async () => {
    server.use(
      http.get(UNAUTH_URL, () =>
        HttpResponse.json({ error: { code: 'ERR_UNAUTHENTICATED' } }, { status: 401 }),
      ),
    )

    await expect(httpClient.get(UNAUTH_URL)).rejects.toBeInstanceOf(HttpError)
    expect(window.location.assign).not.toHaveBeenCalled()
  })
})
