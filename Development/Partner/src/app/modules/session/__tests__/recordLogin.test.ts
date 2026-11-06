import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { http } from 'msw'
import { server } from '../../../../mocks/server'
import { sessionResponses } from '../../../../mocks/data/partnerSession'
import { HttpError } from '../../../../shared/api/httpClient'
import {
  __clearSessionListeners,
  onSessionLost,
  type SessionLostReason,
} from '../../../../shared/auth/sessionEvents'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { SESSION_ENDPOINTS } from '../constants'
import { recordLoginQuietly } from '../recordLogin'
import { sessionService } from '../services'

/** Lets the fire-and-forget call settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

let reasons: SessionLostReason[]

beforeEach(() => {
  reasons = []
  onSessionLost((reason) => reasons.push(reason))
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

afterEach(() => {
  __clearSessionListeners()
})

describe('sessionService.recordLogin', () => {
  it('returns the stamped timestamp', async () => {
    const result = await sessionService.recordLogin()
    expect(result.lastActiveAt).toBe('2026-08-03T09:12:04.000Z')
  })

  it('sends the bearer token and no body at all', async () => {
    // Taking no input is what makes "the caller's own row" unbypassable.
    let auth: string | null = null
    let body = 'unset'
    server.use(
      http.post(SESSION_ENDPOINTS.loginRecorded, async ({ request }) => {
        auth = request.headers.get('Authorization')
        body = await request.text()
        return sessionResponses.loginRecorded()
      }),
    )

    await sessionService.recordLogin()

    expect(auth).toBe('Bearer access-1')
    expect(body).toBe('')
  })

  it('surfaces a failure to a caller that awaits it', async () => {
    server.use(http.post(SESSION_ENDPOINTS.loginRecorded, sessionResponses.internal))

    await expect(sessionService.recordLogin()).rejects.toBeInstanceOf(HttpError)
  })
})

describe('recordLoginQuietly', () => {
  it('records the login', async () => {
    let calls = 0
    server.use(
      http.post(SESSION_ENDPOINTS.loginRecorded, () => {
        calls += 1
        return sessionResponses.loginRecorded()
      }),
    )

    recordLoginQuietly()
    await flush()

    expect(calls).toBe(1)
  })

  it('swallows a server failure without throwing', async () => {
    // Best-effort (J2 BR-16): the login it follows must not be undone by this.
    server.use(http.post(SESSION_ENDPOINTS.loginRecorded, sessionResponses.internal))

    expect(() => {
      recordLoginQuietly()
    }).not.toThrow()
    await flush()

    expect(reasons).toEqual([])
    expect(tokenStore.hasSession()).toBe(true)
  })

  it('swallows a network failure without throwing', async () => {
    server.use(http.post(SESSION_ENDPOINTS.loginRecorded, () => Response.error()))

    expect(() => {
      recordLoginQuietly()
    }).not.toThrow()
    await flush()

    expect(tokenStore.hasSession()).toBe(true)
  })

  it('still lets the session policy act on a 401', async () => {
    // The standard handling has to survive: the policy runs inside httpClient,
    // before this function's catch.
    server.use(http.post(SESSION_ENDPOINTS.loginRecorded, sessionResponses.tokenInvalid))

    recordLoginQuietly()
    await flush()

    expect(reasons).toEqual(['TOKEN_INVALID'])
    expect(tokenStore.hasSession()).toBe(false)
  })

  it('still lets the session policy act on a 403 suspension', async () => {
    server.use(http.post(SESSION_ENDPOINTS.loginRecorded, sessionResponses.suspended))

    recordLoginQuietly()
    await flush()

    expect(reasons).toEqual(['ACCOUNT_SUSPENDED'])
    expect(tokenStore.hasSession()).toBe(false)
  })
})
