/**
 * FE1 BR-02 — renewal is client↔Cognito, and **no backend refresh endpoint
 * exists on any surface**.
 *
 * The other two suites each stop at a different boundary: sessionContract mocks
 * cognitoService (proving httpClient asks for a renewal, but not what that
 * does), and cognitoService.test mocks the AWS SDK (proving the exchange is
 * shaped right, but not that the session layer reaches it). Neither would fail
 * if someone reintroduced a `fetch('/api/auth/refresh')` inside renewSession.
 *
 * This suite mocks **only the AWS transport**, so a real 401 travels through
 * httpClient → sessionManager → the real cognitoService, and asserts both that
 * the refresh token went to Cognito and that no HTTP request went anywhere near
 * a backend refresh route.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../mocks/server'

const send = vi.fn()

vi.mock('@aws-sdk/client-cognito-identity-provider', () => {
  class CommandStub {
    input: unknown
    constructor(input: unknown) {
      this.input = input
    }
  }
  return {
    CognitoIdentityProviderClient: class {
      send = send
    },
    InitiateAuthCommand: CommandStub,
    GetUserCommand: CommandStub,
    GlobalSignOutCommand: CommandStub,
  }
})

const { httpClient } = await import('../httpClient')
const { resetSessionStateForTests } = await import('../sessionManager')
const { ENV } = await import('../../../configs/env')

const URL = '/api/v1/renewal-transport'
const EXPIRED = 'expired-access-token'
const RENEWED = 'renewed-access-token'

const originalLocation = window.location

/** Every URL MSW sees, so we can prove nothing hit a backend refresh route. */
const seenUrls: string[] = []
const recordRequest = ({ request }: { request: Request }) => {
  seenUrls.push(request.url)
}

beforeEach(() => {
  resetSessionStateForTests()
  send.mockReset()
  seenUrls.length = 0
  server.events.on('request:start', recordRequest)
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, assign: vi.fn(), pathname: '/restaurants' },
  })
})

afterEach(() => {
  server.events.removeListener('request:start', recordRequest)
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
})

/** 401 ERR_TOKEN_EXPIRED once, then 200 — the ordinary recoverable path. */
function expireOnce() {
  const requests: Request[] = []
  let first = true
  server.use(
    http.get(URL, ({ request }) => {
      requests.push(request.clone() as Request)
      if (first) {
        first = false
        return HttpResponse.json(
          { success: false, error: { code: 'ERR_TOKEN_EXPIRED' } },
          { status: 401 },
        )
      }
      return HttpResponse.json({ success: true, data: { ok: true } })
    }),
  )
  return requests
}

describe('FE1 BR-02 · the renewal exchange goes to Cognito, not to a backend endpoint', () => {
  it('sends the stored refresh token to Cognito via REFRESH_TOKEN_AUTH', async () => {
    localStorage.setItem('auth-token', EXPIRED)
    localStorage.setItem('auth-refresh-token', 'refresh-token-1')
    send.mockResolvedValueOnce({ AuthenticationResult: { AccessToken: RENEWED } })
    const requests = expireOnce()

    await expect(httpClient.get(URL)).resolves.toEqual({ ok: true })

    // Exactly one exchange, and it is a Cognito InitiateAuth REFRESH_TOKEN_AUTH
    // carrying the refresh token — never the access token.
    expect(send).toHaveBeenCalledTimes(1)
    const command = send.mock.calls[0][0] as {
      input: { AuthFlow: string; ClientId: string; AuthParameters: Record<string, string> }
    }
    expect(command.input.AuthFlow).toBe('REFRESH_TOKEN_AUTH')
    expect(command.input.ClientId).toBe(ENV.COGNITO_CLIENT_ID)
    expect(command.input.AuthParameters.REFRESH_TOKEN).toBe('refresh-token-1')
    expect(command.input.AuthParameters.REFRESH_TOKEN).not.toBe(EXPIRED)

    // The renewed token is persisted and used for the replay.
    expect(localStorage.getItem('auth-token')).toBe(RENEWED)
    expect(requests[1].headers.get('Authorization')).toBe(`Bearer ${RENEWED}`)
  })

  it('makes no HTTP request to any backend refresh route', async () => {
    localStorage.setItem('auth-token', EXPIRED)
    localStorage.setItem('auth-refresh-token', 'refresh-token-1')
    send.mockResolvedValueOnce({ AuthenticationResult: { AccessToken: RENEWED } })
    expireOnce()

    await httpClient.get(URL)

    // The only traffic is the original call and its replay. A reintroduced
    // POST /api/auth/refresh (or any refresh route) would show up here.
    expect(seenUrls).toHaveLength(2)
    expect(seenUrls.filter((u) => /refresh/i.test(u))).toEqual([])
    expect(seenUrls.every((u) => u.includes(URL))).toBe(true)
  })

  it('terminates without any network call when no refresh token is stored', async () => {
    localStorage.setItem('auth-token', EXPIRED)
    // No 'auth-refresh-token' — the real cognitoService rejects before calling out.
    expireOnce()

    await expect(httpClient.get(URL)).rejects.toBeTruthy()

    expect(send).not.toHaveBeenCalled()
    // One request only: the original. No replay, and nothing resembling a refresh.
    expect(seenUrls).toHaveLength(1)
    expect(seenUrls.filter((u) => /refresh/i.test(u))).toEqual([])
    expect(window.location.assign).toHaveBeenCalledWith('/login')
  })

  it('terminates when Cognito itself rejects the exchange', async () => {
    localStorage.setItem('auth-token', EXPIRED)
    localStorage.setItem('auth-refresh-token', 'revoked')
    send.mockRejectedValueOnce(new Error('NotAuthorizedException'))
    expireOnce()

    await expect(httpClient.get(URL)).rejects.toBeTruthy()

    expect(send).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('auth-token')).toBeNull()
    expect(window.location.assign).toHaveBeenCalledWith('/login')
  })

  it('performs a single Cognito exchange for concurrent expiries', async () => {
    localStorage.setItem('auth-token', EXPIRED)
    localStorage.setItem('auth-refresh-token', 'refresh-token-1')
    send.mockResolvedValue({ AuthenticationResult: { AccessToken: RENEWED } })

    let remaining = 4
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

    await Promise.all(Array.from({ length: 4 }, () => httpClient.get(URL)))

    // Single-flight holds through the real service: one exchange with Cognito,
    // which is what protects the session under refresh-token rotation.
    expect(send).toHaveBeenCalledTimes(1)
  })
})
