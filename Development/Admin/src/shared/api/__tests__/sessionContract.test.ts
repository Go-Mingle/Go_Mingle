/**
 * FE1 — Frontend Session & Auth Request Contract, §5 Verification Matrix.
 *
 * One case per row of the BR-03 decision table. The two branches that carry
 * real risk get the most attention: renewing on a 403 would hide a suspension
 * behind a generic logout, and omitting single-flight would let parallel
 * exchanges invalidate the session under refresh-token rotation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../mocks/server'
import { httpClient, HttpError, redactTokens } from '../httpClient'
import {
  SESSION_NOTICE_KEY,
  initSessionChannel,
  readAndClearSessionNotice,
  resetSessionStateForTests,
} from '../sessionManager'
import { store } from '../../store/store'
import { loginAction } from '../../store/authSlice'
import { refreshAccessToken, cognitoSignOut } from '../../../app/modules/auth/cognitoService'

vi.mock('../../../app/modules/auth/cognitoService', () => ({
  refreshAccessToken: vi.fn(),
  cognitoSignOut: vi.fn(),
}))

const mockRefresh = vi.mocked(refreshAccessToken)
const mockSignOut = vi.mocked(cognitoSignOut)

const URL = '/api/v1/session-contract'
const EXPIRED_TOKEN = 'expired-access-token'
const NEW_TOKEN = 'renewed-access-token'

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

/** Puts a live session in place: a stored access token plus Redux state. */
function signIn(token = EXPIRED_TOKEN) {
  localStorage.setItem('auth-token', token)
  store.dispatch(loginAction(authUser))
}

/** Responds 401/403 with the given code until `failures` is exhausted, then 200. */
function respondWith(status: number, code: string, failures = 1, payload: unknown = { ok: true }) {
  const seen: Request[] = []
  let remaining = failures
  server.use(
    http.all(URL, ({ request }) => {
      seen.push(request.clone() as Request)
      if (remaining > 0) {
        remaining -= 1
        return HttpResponse.json({ success: false, error: { code } }, { status })
      }
      return HttpResponse.json({ success: true, data: payload })
    }),
  )
  return seen
}

beforeEach(() => {
  resetSessionStateForTests()
  mockRefresh.mockReset()
  mockSignOut.mockReset()
  mockRefresh.mockImplementation(async () => {
    localStorage.setItem('auth-token', NEW_TOKEN)
    return NEW_TOKEN
  })
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, assign: vi.fn(), pathname: '/restaurants' },
  })
})

afterEach(async () => {
  // Let late async work settle *before* the stubs come down. BroadcastChannel
  // delivery is a task, not a microtask, so a termination broadcast can arrive
  // after the test body has finished. `vi.unstubAllGlobals()` strips the
  // localStorage stub that setupTests installs, so an arrival after that point
  // turns `expireSessionAction`'s storage cleanup into an uncaught
  // "localStorage.removeItem is not a function" — which Vitest reports as an
  // unhandled error and warns may cause false positives.
  await new Promise((resolve) => setTimeout(resolve, 0))
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  vi.unstubAllGlobals()
})

describe('FE1 · US-01 — silent renewal and replay', () => {
  it('AC-01.1 renews once, replays once and returns the data with no interruption', async () => {
    signIn()
    const seen = respondWith(401, 'ERR_TOKEN_EXPIRED')

    await expect(httpClient.get(URL)).resolves.toEqual({ ok: true })

    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(seen).toHaveLength(2)
    expect(window.location.assign).not.toHaveBeenCalled()
    expect(store.getState().auth.isAuthenticated).toBe(true)
    expect(sessionStorage.getItem(SESSION_NOTICE_KEY)).toBeNull()
  })

  it('AC-01.4 replays with the same method and body, changing only the token', async () => {
    signIn()
    const seen = respondWith(401, 'ERR_TOKEN_EXPIRED')

    await httpClient.post(URL, { name: 'Aurelia' })

    expect(seen).toHaveLength(2)
    expect(seen[0].method).toBe('POST')
    expect(seen[1].method).toBe('POST')
    await expect(seen[0].json()).resolves.toEqual({ name: 'Aurelia' })
    await expect(seen[1].json()).resolves.toEqual({ name: 'Aurelia' })
    expect(seen[0].headers.get('Authorization')).toBe(`Bearer ${EXPIRED_TOKEN}`)
    expect(seen[1].headers.get('Authorization')).toBe(`Bearer ${NEW_TOKEN}`)
  })

  it('AC-01.2 a write request replays and produces exactly one success', async () => {
    signIn()
    const seen = respondWith(401, 'ERR_TOKEN_EXPIRED', 1, { id: 'created-1' })

    await expect(httpClient.patch(URL, { visible: true })).resolves.toEqual({ id: 'created-1' })
    // The rejected attempt executed no handler (Admin F1 AC-004), so the single
    // replay is the only server-side effect.
    expect(seen).toHaveLength(2)
  })
})

describe('FE1 · US-02 — concurrent expiries', () => {
  it('AC-02.1 performs exactly one renewal for N simultaneous 401s and replays all N', async () => {
    signIn()
    let remaining = 5
    server.use(
      http.get(URL, () => {
        if (remaining > 0) {
          remaining -= 1
          return HttpResponse.json(
            { success: false, error: { code: 'ERR_TOKEN_EXPIRED' } },
            { status: 401 },
          )
        }
        return HttpResponse.json({ success: true, data: { ok: true } })
      }),
    )

    const results = await Promise.all(Array.from({ length: 5 }, () => httpClient.get(URL)))

    expect(results).toEqual(Array.from({ length: 5 }, () => ({ ok: true })))
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(window.location.assign).not.toHaveBeenCalled()
  })

  it('AC-02.2 drops every queued request and terminates once when the renewal fails', async () => {
    signIn()
    mockRefresh.mockRejectedValue(new Error('refresh token revoked'))
    server.use(
      http.get(URL, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_TOKEN_EXPIRED' } },
          { status: 401 },
        ),
      ),
    )

    const results = await Promise.allSettled(Array.from({ length: 5 }, () => httpClient.get(URL)))

    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    // One renewal, one termination — not five of each.
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(window.location.assign).toHaveBeenCalledTimes(1)
    expect(store.getState().auth.isAuthenticated).toBe(false)
    expect(localStorage.getItem('auth-token')).toBeNull()
  })
})

describe('FE1 · US-03 — a dead session ends cleanly', () => {
  it('AC-03.1 terminates when the renewal call itself fails', async () => {
    signIn()
    mockRefresh.mockRejectedValue(new Error('NotAuthorizedException'))
    respondWith(401, 'ERR_TOKEN_EXPIRED')

    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)

    expect(store.getState().auth.isAuthenticated).toBe(false)
    expect(window.location.assign).toHaveBeenCalledWith('/login')
    expect(readAndClearSessionNotice()).toBe('EXPIRED')
  })

  it('AC-03.2 terminates without a third attempt when the replay 401s again', async () => {
    signIn()
    const seen = respondWith(401, 'ERR_TOKEN_EXPIRED', 2)

    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)

    expect(seen).toHaveLength(2)
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(store.getState().auth.isAuthenticated).toBe(false)
  })

  it('AC-03.3 terminates on ERR_TOKEN_INVALID without attempting a renewal', async () => {
    signIn()
    const seen = respondWith(401, 'ERR_TOKEN_INVALID', 1)

    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)

    expect(mockRefresh).not.toHaveBeenCalled()
    expect(seen).toHaveLength(1)
    expect(readAndClearSessionNotice()).toBe('INVALID')
    expect(store.getState().auth.isAuthenticated).toBe(false)
  })

  it('AC-03.4 treats a cross-pool token (ERR_TOKEN_INVALID) the same way', async () => {
    signIn('token-from-another-pool')
    respondWith(401, 'ERR_TOKEN_INVALID', 1)

    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)

    expect(mockRefresh).not.toHaveBeenCalled()
    expect(window.location.assign).toHaveBeenCalledWith('/login')
  })

  it('AC-03.5 never calls Cognito signOut on a termination path', async () => {
    signIn()
    respondWith(401, 'ERR_TOKEN_INVALID', 1)

    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)

    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('terminates on a 401 carrying any other code', async () => {
    signIn()
    respondWith(401, 'ERR_UNAUTHENTICATED', 1)

    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)

    expect(mockRefresh).not.toHaveBeenCalled()
    expect(store.getState().auth.isAuthenticated).toBe(false)
  })
})

describe('FE1 · US-04 — a suspended account is told why', () => {
  it('AC-04.1/04.2/04.4 shows the suspension message, never renews, then ends access', async () => {
    signIn()
    const seen = respondWith(403, 'ERR_ACCOUNT_SUSPENDED', 1)

    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)

    // No renewal and no replay.
    expect(mockRefresh).not.toHaveBeenCalled()
    expect(seen).toHaveLength(1)
    // The message is carried across the redirect rather than lost to it.
    expect(sessionStorage.getItem(SESSION_NOTICE_KEY)).toBe('SUSPENDED')
    // …and access ends after it is recorded.
    expect(store.getState().auth.isAuthenticated).toBe(false)
    expect(window.location.assign).toHaveBeenCalledWith('/login')
  })

  it('row 9 — a non-suspension 403 is an ordinary error and the session stays valid', async () => {
    signIn()
    respondWith(403, 'ERR_PERMISSION_DENIED', 1)

    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)

    expect(mockRefresh).not.toHaveBeenCalled()
    expect(store.getState().auth.isAuthenticated).toBe(true)
    expect(window.location.assign).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(SESSION_NOTICE_KEY)).toBeNull()
  })
})

describe('FE1 · rows 10 & 13 — outcomes that must never renew', () => {
  it('does not renew on 500', async () => {
    signIn()
    respondWith(500, 'ERR_INTERNAL', 1)

    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)

    expect(mockRefresh).not.toHaveBeenCalled()
    expect(store.getState().auth.isAuthenticated).toBe(true)
  })

  it('does not renew on 503', async () => {
    signIn()
    respondWith(503, 'ERR_SERVICE_UNAVAILABLE', 1)

    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('does not renew on a 422', async () => {
    signIn()
    respondWith(422, 'ERR_VALIDATION', 1)

    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)
    expect(mockRefresh).not.toHaveBeenCalled()
    expect(store.getState().auth.isAuthenticated).toBe(true)
  })

  it('does not renew on a network failure', async () => {
    signIn()
    server.use(http.get(URL, () => HttpResponse.error()))

    await expect(httpClient.get(URL)).rejects.toBeTruthy()

    expect(mockRefresh).not.toHaveBeenCalled()
    expect(window.location.assign).not.toHaveBeenCalled()
  })

  it('BR-08 — a 401 with no session never renews and never terminates', async () => {
    // No signIn(): no token stored.
    respondWith(401, 'ERR_TOKEN_EXPIRED', 1)

    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)

    expect(mockRefresh).not.toHaveBeenCalled()
    expect(window.location.assign).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(SESSION_NOTICE_KEY)).toBeNull()
  })
})

describe('FE1 · BR-09 — multi-tab', () => {
  it('skips the renewal when another tab already replaced the token', async () => {
    signIn()
    server.use(
      http.get(URL, ({ request }) => {
        if (request.headers.get('Authorization') === `Bearer ${EXPIRED_TOKEN}`) {
          // Simulate a sibling tab renewing between the failure and our retry.
          localStorage.setItem('auth-token', NEW_TOKEN)
          return HttpResponse.json(
            { success: false, error: { code: 'ERR_TOKEN_EXPIRED' } },
            { status: 401 },
          )
        }
        return HttpResponse.json({ success: true, data: { ok: true } })
      }),
    )

    await expect(httpClient.get(URL)).resolves.toEqual({ ok: true })

    // The other tab's token was reused rather than a second exchange performed.
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('signs this tab out when another tab broadcasts a termination', () => {
    signIn()
    const listeners: ((e: MessageEvent) => void)[] = []
    class ChannelStub {
      onmessage: ((e: MessageEvent) => void) | null = null
      constructor() {
        listeners.push((e) => this.onmessage?.(e))
      }
      postMessage() {}
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', ChannelStub)
    resetSessionStateForTests()

    initSessionChannel()
    listeners[0]({ data: { type: 'TERMINATED', reason: 'SUSPENDED' } } as MessageEvent)

    expect(store.getState().auth.isAuthenticated).toBe(false)
    expect(sessionStorage.getItem(SESSION_NOTICE_KEY)).toBe('SUSPENDED')
    expect(window.location.assign).toHaveBeenCalledWith('/login')
  })

  it('ignores unrelated broadcast messages', () => {
    signIn()
    const listeners: ((e: MessageEvent) => void)[] = []
    class ChannelStub {
      onmessage: ((e: MessageEvent) => void) | null = null
      constructor() {
        listeners.push((e) => this.onmessage?.(e))
      }
      postMessage() {}
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', ChannelStub)
    resetSessionStateForTests()

    initSessionChannel()
    listeners[0]({ data: { type: 'SOMETHING_ELSE' } } as MessageEvent)

    expect(store.getState().auth.isAuthenticated).toBe(true)
    expect(window.location.assign).not.toHaveBeenCalled()
  })

  it('broadcasts the termination to sibling tabs', async () => {
    signIn()
    const posted: unknown[] = []
    class ChannelStub {
      onmessage: ((e: MessageEvent) => void) | null = null
      postMessage(msg: unknown) {
        posted.push(msg)
      }
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', ChannelStub)
    resetSessionStateForTests()

    respondWith(401, 'ERR_TOKEN_INVALID', 1)
    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)

    expect(posted).toEqual([{ type: 'TERMINATED', reason: 'INVALID' }])
  })

  it('initSessionChannel is a no-op where BroadcastChannel is unavailable', () => {
    // jsdom has no BroadcastChannel — the guard must not throw.
    expect(() => initSessionChannel()).not.toThrow()
  })

  it('reuses one channel across calls and ignores a message without a reason', () => {
    signIn()
    const created: ChannelStub[] = []
    const listeners: ((e: MessageEvent) => void)[] = []
    class ChannelStub {
      onmessage: ((e: MessageEvent) => void) | null = null
      constructor() {
        created.push(this)
        listeners.push((e) => this.onmessage?.(e))
      }
      postMessage() {}
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', ChannelStub)
    resetSessionStateForTests()

    initSessionChannel()
    initSessionChannel()
    // One channel per tab, not one per call.
    expect(created).toHaveLength(1)

    listeners[0]({ data: null } as MessageEvent)
    expect(store.getState().auth.isAuthenticated).toBe(true)

    // A termination with no reason still ends the session, without a notice.
    listeners[0]({ data: { type: 'TERMINATED' } } as MessageEvent)
    expect(store.getState().auth.isAuthenticated).toBe(false)
    expect(sessionStorage.getItem(SESSION_NOTICE_KEY)).toBeNull()
  })
})

describe('FE1 · BR-06/07 — termination is idempotent', () => {
  it('a second terminal response neither re-notifies nor re-redirects', async () => {
    signIn()
    server.use(
      http.get(URL, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_TOKEN_INVALID' } },
          { status: 401 },
        ),
      ),
    )

    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)
    expect(window.location.assign).toHaveBeenCalledTimes(1)

    // The token is gone after the first termination, so a later call is a
    // no-op both ways — one clean transition, never a cascade.
    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)
    expect(window.location.assign).toHaveBeenCalledTimes(1)
  })

  it('does not redirect when the user is already on /login', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, assign: vi.fn(), pathname: '/login' },
    })
    signIn()
    respondWith(401, 'ERR_TOKEN_INVALID', 1)

    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)

    expect(window.location.assign).not.toHaveBeenCalled()
    expect(store.getState().auth.isAuthenticated).toBe(false)
  })
})

describe('FE1 · BR-11 — tokens never leave the client in logs', () => {
  it('redacts every token-shaped field from a captured body', () => {
    const body = JSON.stringify({
      error: { code: 'ERR_TOKEN_EXPIRED' },
      token: 'eyJhbGciOi.secret',
      accessToken: 'eyJhbGciOi.secret',
      refresh_token: 'eyJhbGciOi.secret',
      idToken: 'eyJhbGciOi.secret',
      authorization: 'Bearer eyJhbGciOi.secret',
    })

    const redacted = redactTokens(body)

    expect(redacted).not.toContain('eyJhbGciOi.secret')
    expect(redacted).toContain('"[REDACTED]"')
    // Non-sensitive fields survive so the report stays useful.
    expect(redacted).toContain('ERR_TOKEN_EXPIRED')
  })

  it('passes through a body with nothing to redact, and handles undefined', () => {
    expect(redactTokens('{"error":{"code":"ERR_VALIDATION"}}')).toBe(
      '{"error":{"code":"ERR_VALIDATION"}}',
    )
    expect(redactTokens(undefined)).toBeUndefined()
  })
})

describe('FE1 · session notice', () => {
  it('is consumed on read so a later visit to /login shows nothing', () => {
    sessionStorage.setItem(SESSION_NOTICE_KEY, 'SUSPENDED')

    expect(readAndClearSessionNotice()).toBe('SUSPENDED')
    expect(readAndClearSessionNotice()).toBeNull()
  })
})
