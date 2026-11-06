import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../mocks/server'
import { setAuthProvider } from '../../auth/authProvider'
import { AuthError } from '../../auth/authError'
import { __resetRefreshCoordinator } from '../../auth/refreshCoordinator'
import {
  onSessionLost,
  __clearSessionListeners,
  type SessionLostReason,
} from '../../auth/sessionEvents'
import { tokenStore } from '../../auth/tokenStore'
import type { PartnerAuthProvider } from '../../auth/types'
import { expectDiscarded } from '../../../test-utils/expectDiscarded'
import { httpClient, HttpError, publicHttpClient } from '../httpClient'

const URL = '/api/v1/partner/session'

/** Builds the backend's error envelope for a given code + status. */
function apiError(code: string, status: number) {
  return HttpResponse.json({ success: false, error: { code, message: code } }, { status })
}

let refresh: ReturnType<typeof vi.fn>
let reasons: SessionLostReason[]

beforeEach(() => {
  reasons = []
  onSessionLost((reason) => reasons.push(reason))

  refresh = vi.fn(() => {
    tokenStore.setAccessToken('access-2', Date.now() + 1000)
    return Promise.resolve('access-2')
  })
  setAuthProvider({
    signIn: vi.fn(),
    getAccessToken: () => tokenStore.getAccessToken(),
    refresh,
    signOut: vi.fn(),
    getIdentity: () => null,
  } as unknown as PartnerAuthProvider)

  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 1 })
})

afterEach(() => {
  __clearSessionListeners()
  __resetRefreshCoordinator()
  setAuthProvider(null)
})

describe('401 ERR_TOKEN_EXPIRED — silent renewal', () => {
  it('refreshes once, retries once, and succeeds without ending the session', async () => {
    let calls = 0
    server.use(
      http.get(URL, () => {
        calls += 1
        return calls === 1
          ? apiError('ERR_TOKEN_EXPIRED', 401)
          : HttpResponse.json({ success: true, data: { route: 'FULL_PORTAL' } })
      }),
    )

    await expect(httpClient.get(URL)).resolves.toEqual({ route: 'FULL_PORTAL' })
    expect(refresh).toHaveBeenCalledOnce()
    expect(calls).toBe(2)
    expect(reasons).toEqual([])
    expect(tokenStore.hasSession()).toBe(true)
  })

  it('sends the newly minted token on the retry', async () => {
    const sent: (string | null)[] = []
    let calls = 0
    server.use(
      http.get(URL, ({ request }) => {
        sent.push(request.headers.get('Authorization'))
        calls += 1
        return calls === 1
          ? apiError('ERR_TOKEN_EXPIRED', 401)
          : HttpResponse.json({ success: true, data: {} })
      }),
    )

    await httpClient.get(URL)

    expect(sent).toEqual(['Bearer access-1', 'Bearer access-2'])
  })

  it('gives up after one retry when the retry is also a 401', async () => {
    let calls = 0
    server.use(
      http.get(URL, () => {
        calls += 1
        return apiError('ERR_TOKEN_EXPIRED', 401)
      }),
    )

    // BR-06b — a replayed request that 401s again terminates; it is never
    // replayed a third time.
    await expectDiscarded(httpClient.get(URL))
    expect(calls).toBe(2)
    expect(refresh).toHaveBeenCalledOnce()
    expect(reasons).toEqual(['TOKEN_INVALID'])
  })

  it('ends the session when the refresh itself fails, without retrying', async () => {
    let calls = 0
    refresh.mockRejectedValue(new AuthError('REFRESH_FAILED'))
    server.use(
      http.get(URL, () => {
        calls += 1
        return apiError('ERR_TOKEN_EXPIRED', 401)
      }),
    )

    await expectDiscarded(httpClient.get(URL))
    expect(calls).toBe(1)
    expect(reasons).toEqual(['REFRESH_FAILED'])
    expect(tokenStore.hasSession()).toBe(false)
  })

  it('coalesces concurrent expiries into a single refresh', async () => {
    const seen = new Map<string, number>()
    server.use(
      http.get(URL, ({ request }) => {
        const token = request.headers.get('Authorization') ?? ''
        seen.set(token, (seen.get(token) ?? 0) + 1)
        return token === 'Bearer access-1'
          ? apiError('ERR_TOKEN_EXPIRED', 401)
          : HttpResponse.json({ success: true, data: { ok: true } })
      }),
    )

    const results = await Promise.all([httpClient.get(URL), httpClient.get(URL)])

    expect(results).toEqual([{ ok: true }, { ok: true }])
    expect(refresh).toHaveBeenCalledOnce()
  })
})

describe('401 ERR_TOKEN_INVALID — unrecoverable', () => {
  it('ends the session without attempting a refresh or a retry', async () => {
    let calls = 0
    server.use(
      http.get(URL, () => {
        calls += 1
        return apiError('ERR_TOKEN_INVALID', 401)
      }),
    )

    await expectDiscarded(httpClient.get(URL))
    expect(refresh).not.toHaveBeenCalled()
    expect(calls).toBe(1)
    expect(reasons).toEqual(['TOKEN_INVALID'])
    expect(tokenStore.hasSession()).toBe(false)
  })

  it('treats a 401 with no error code the same way', async () => {
    server.use(http.get(URL, () => new HttpResponse(null, { status: 401 })))

    await expectDiscarded(httpClient.get(URL))
    expect(refresh).not.toHaveBeenCalled()
    expect(reasons).toEqual(['TOKEN_INVALID'])
  })
})

describe('403 ERR_ACCOUNT_SUSPENDED — must never loop', () => {
  it('makes exactly one request, never refreshes, and never retries', async () => {
    let calls = 0
    server.use(
      http.get(URL, () => {
        calls += 1
        return apiError('ERR_ACCOUNT_SUSPENDED', 403)
      }),
    )

    // AC-04.1/AC-04.2 — the suspension reason must reach the user as its own
    // message, so it is emitted rather than thrown at an arbitrary call site.
    await expectDiscarded(httpClient.get(URL))

    // The three assertions that matter: one call, zero refreshes, session gone.
    expect(calls).toBe(1)
    expect(refresh).not.toHaveBeenCalled()
    expect(reasons).toEqual(['ACCOUNT_SUSPENDED'])
    expect(tokenStore.hasSession()).toBe(false)
  })

  it('does not loop when a suspension lands on the retry after a renewal', async () => {
    let calls = 0
    server.use(
      http.get(URL, () => {
        calls += 1
        return calls === 1
          ? apiError('ERR_TOKEN_EXPIRED', 401)
          : apiError('ERR_ACCOUNT_SUSPENDED', 403)
      }),
    )

    await expectDiscarded(httpClient.get(URL))
    expect(calls).toBe(2)
    expect(refresh).toHaveBeenCalledOnce()
    expect(reasons).toEqual(['ACCOUNT_SUSPENDED'])
  })

  it('leaves the session alone for a 403 that is not a suspension', async () => {
    server.use(http.get(URL, () => apiError('ERR_FORBIDDEN_SOMETHING_ELSE', 403)))

    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)
    expect(reasons).toEqual([])
    expect(tokenStore.hasSession()).toBe(true)
  })
})

describe('BR-08 — a request made without a session never renews', () => {
  beforeEach(() => {
    tokenStore.clear()
  })

  /**
   * There is no refresh token to exchange, and no session to end. Terminating
   * here would toast "your session has expired" at someone who never had one.
   */
  it.each([
    ['ERR_TOKEN_EXPIRED', 'ERR_TOKEN_EXPIRED'],
    ['ERR_TOKEN_INVALID', 'ERR_TOKEN_INVALID'],
  ])('rejects a 401 %s to the caller without renewing or terminating', async (_label, code) => {
    let calls = 0
    server.use(
      http.get(URL, () => {
        calls += 1
        return apiError(code, 401)
      }),
    )

    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)
    expect(refresh).not.toHaveBeenCalled()
    expect(calls).toBe(1)
    expect(reasons).toEqual([])
  })

  it('sends no Authorization header at all', async () => {
    const sent: (string | null)[] = []
    server.use(
      http.get(URL, ({ request }) => {
        sent.push(request.headers.get('Authorization'))
        return apiError('ERR_TOKEN_EXPIRED', 401)
      }),
    )

    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)
    expect(sent).toEqual([null])
  })

  /** Once a session exists the ordinary recovery path applies again. */
  it('recovers normally once a session is present', async () => {
    tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 1 })
    let calls = 0
    server.use(
      http.get(URL, () => {
        calls += 1
        return calls === 1
          ? apiError('ERR_TOKEN_EXPIRED', 401)
          : HttpResponse.json({ success: true, data: { ok: true } })
      }),
    )

    await expect(httpClient.get(URL)).resolves.toEqual({ ok: true })
    expect(refresh).toHaveBeenCalledOnce()
  })
})

describe('AC-02.2 — concurrent failures terminate exactly once', () => {
  it('emits one reason for five requests whose shared renewal fails', async () => {
    refresh.mockRejectedValue(new AuthError('REFRESH_FAILED'))
    server.use(http.get(URL, () => apiError('ERR_TOKEN_EXPIRED', 401)))

    const inFlight = Array.from({ length: 5 }, () => httpClient.get(URL))
    inFlight.forEach((promise) => void promise.catch(() => undefined))

    // Not five reasons, and therefore not five toasts and five redirects.
    await expectDiscarded(inFlight[0])
    expect(reasons).toEqual(['REFRESH_FAILED'])
    expect(refresh).toHaveBeenCalledOnce()
    expect(tokenStore.hasSession()).toBe(false)
  })

  it('drops every one of them rather than surfacing five errors', async () => {
    refresh.mockRejectedValue(new AuthError('REFRESH_FAILED'))
    server.use(http.get(URL, () => apiError('ERR_TOKEN_EXPIRED', 401)))

    const inFlight = Array.from({ length: 5 }, () => httpClient.get(URL))
    await Promise.all(inFlight.map((promise) => expectDiscarded(promise)))
  })

  /**
   * Termination clears the tokens, so anything issued afterwards is a
   * sessionless request and takes the BR-08 path — it rejects to its caller
   * and cannot emit a second termination for the same event.
   */
  it('treats a request issued after termination as sessionless, emitting once', async () => {
    server.use(http.get(URL, () => apiError('ERR_TOKEN_INVALID', 401)))

    await expectDiscarded(httpClient.get(URL))
    await expect(httpClient.get(URL)).rejects.toBeInstanceOf(HttpError)

    expect(reasons).toEqual(['TOKEN_INVALID'])
    expect(refresh).not.toHaveBeenCalled()
  })

  /** A fresh session re-arms the latch, or a later expiry would go unnoticed. */
  it('emits again after a new session is stored', async () => {
    server.use(http.get(URL, () => apiError('ERR_TOKEN_INVALID', 401)))
    await expectDiscarded(httpClient.get(URL))

    tokenStore.setTokens({ accessToken: 'access-9', refreshToken: 'refresh-9', expiresAt: 1 })
    await expectDiscarded(httpClient.get(URL))

    expect(reasons).toEqual(['TOKEN_INVALID', 'TOKEN_INVALID'])
  })
})

describe('non-session failures leave the session intact', () => {
  it.each([
    ['404 ERR_NOT_FOUND', 'ERR_NOT_FOUND', 404],
    ['503 ERR_SERVICE_UNAVAILABLE', 'ERR_SERVICE_UNAVAILABLE', 503],
    ['500 ERR_INTERNAL', 'ERR_INTERNAL', 500],
  ])('%s throws without ending the session', async (_label, code, status) => {
    let calls = 0
    server.use(
      http.get(URL, () => {
        calls += 1
        return apiError(code, status)
      }),
    )

    const error = (await httpClient.get(URL).catch((e: unknown) => e)) as HttpError
    expect(error.code).toBe(code)
    expect(error.status).toBe(status)
    expect(calls).toBe(1)
    expect(refresh).not.toHaveBeenCalled()
    expect(reasons).toEqual([])
    expect(tokenStore.hasSession()).toBe(true)
  })

  it('rethrows a network failure without ending the session', async () => {
    server.use(http.get(URL, () => HttpResponse.error()))

    await expect(httpClient.get(URL)).rejects.toBeTruthy()
    expect(reasons).toEqual([])
    expect(tokenStore.hasSession()).toBe(true)
  })
})

describe('publicHttpClient — no session policy at all', () => {
  // The pre-session leg of signup. `signup/complete` deliberately does **not**
  // run on this client: `verify` logs the partner in, so a 401 from `complete`
  // is a genuine session loss and is asserted as such in signupService.test.ts.
  const SIGNUP_URL = '/api/v1/partner/signup/verify'

  it('leaves the session alone on a 401, because signup has no session yet', async () => {
    // No session has been issued at this point, so there is nothing to clear and
    // no refresh token to exchange. Running it through the session policy would
    // bounce the partner to /login with the wrong message.
    server.use(http.post(SIGNUP_URL, () => apiError('ERR_TOKEN_INVALID', 401)))

    const error = (await publicHttpClient
      .post(SIGNUP_URL, { email: 'new@aurelia.pk', code: '123456' })
      .catch((e: unknown) => e)) as HttpError

    expect(error).toBeInstanceOf(HttpError)
    expect(error.code).toBe('ERR_TOKEN_INVALID')
    expect(refresh).not.toHaveBeenCalled()
    expect(reasons).toEqual([])
    expect(tokenStore.hasSession()).toBe(true)
  })

  it('never attempts a refresh on a 401 ERR_TOKEN_EXPIRED either', async () => {
    let calls = 0
    server.use(
      http.post(SIGNUP_URL, () => {
        calls += 1
        return apiError('ERR_TOKEN_EXPIRED', 401)
      }),
    )

    await expect(publicHttpClient.post(SIGNUP_URL, {})).rejects.toBeInstanceOf(HttpError)

    expect(calls).toBe(1)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('leaves the session alone on a 403', async () => {
    server.use(http.post(SIGNUP_URL, () => apiError('ERR_ACCOUNT_SUSPENDED', 403)))

    await expect(publicHttpClient.post(SIGNUP_URL, {})).rejects.toBeInstanceOf(HttpError)

    expect(reasons).toEqual([])
    expect(tokenStore.hasSession()).toBe(true)
  })

  it('still unwraps the envelope and parses error codes', async () => {
    server.use(http.get(SIGNUP_URL, () => HttpResponse.json({ success: true, data: { ok: true } })))
    await expect(publicHttpClient.get(SIGNUP_URL)).resolves.toEqual({ ok: true })
  })
})
