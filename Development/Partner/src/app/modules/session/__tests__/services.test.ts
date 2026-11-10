import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { http } from 'msw'
import { server } from '../../../../mocks/server'
import { sessionResponses } from '../../../../mocks/data/partnerSession'
import { HttpError } from '../../../../shared/api/httpClient'
import {
  onSessionLost,
  __clearSessionListeners,
  type SessionLostReason,
} from '../../../../shared/auth/sessionEvents'
import { __resetRefreshCoordinator } from '../../../../shared/auth/refreshCoordinator'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { expectDiscarded } from '../../../../test-utils/expectDiscarded'
import { SESSION_ENDPOINTS } from '../constants'
import { sessionService } from '../services'

let reasons: SessionLostReason[]

beforeEach(() => {
  reasons = []
  onSessionLost((reason) => reasons.push(reason))
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 1 })
})

afterEach(() => {
  __clearSessionListeners()
  __resetRefreshCoordinator()
})

describe('sessionService.get', () => {
  it('unwraps the envelope and returns the session payload', async () => {
    server.use(http.get(SESSION_ENDPOINTS.session, () => sessionResponses.ok()))

    const session = await sessionService.get()

    expect(session.route).toBe('FULL_PORTAL')
    expect(session.partnerUser).toMatchObject({ id: 'pu1', isPrimary: true })
    expect(session.restaurant).toMatchObject({
      id: 'rest1',
      name: 'Aurelia',
      status: 'ACTIVE',
      payoutReady: false,
      coverImageUrl: null,
    })
  })

  it.each([
    ['PROFILE_SETUP', 'DRAFT'],
    ['UNDER_REVIEW', 'PENDING'],
    ['FULL_PORTAL', 'ACTIVE'],
    ['REJECTED', 'REJECTED'],
  ] as const)('returns %s alongside restaurant status %s', async (route, status) => {
    server.use(http.get(SESSION_ENDPOINTS.session, () => sessionResponses.ok({ route })))

    const session = await sessionService.get()

    expect(session.route).toBe(route)
    expect(session.restaurant.status).toBe(status)
  })

  /** Not auth failures — the session stands and the caller handles them. */
  it.each([
    ['notFound', 404, 'ERR_NOT_FOUND'],
    ['unavailable', 503, 'ERR_SERVICE_UNAVAILABLE'],
    ['internal', 500, 'ERR_INTERNAL'],
  ] as const)('surfaces %s as an HttpError carrying the code', async (scenario, status, code) => {
    server.use(http.get(SESSION_ENDPOINTS.session, sessionResponses[scenario]))

    const error = (await sessionService.get().catch((e: unknown) => e)) as HttpError

    expect(error).toBeInstanceOf(HttpError)
    expect(error.status).toBe(status)
    expect(error.code).toBe(code)
    expect(reasons).toEqual([])
  })

  /**
   * FE1 BR-07 — an auth-terminal response is not handed to the caller. The
   * client ends the session once and discards the request, so the user gets a
   * single toast and redirect instead of one error per in-flight call. The
   * expired case exhausts its one retry first, because the handler keeps
   * returning the same failure (BR-06b).
   */
  it.each([
    ['tokenExpired', 'TOKEN_INVALID'],
    ['tokenInvalid', 'TOKEN_INVALID'],
    ['suspended', 'ACCOUNT_SUSPENDED'],
  ] as const)('discards %s and ends the session as %s', async (scenario, reason) => {
    server.use(http.get(SESSION_ENDPOINTS.session, sessionResponses[scenario]))

    await expectDiscarded(sessionService.get())

    expect(reasons).toEqual([reason])
    expect(tokenStore.hasSession()).toBe(false)
  })

  /**
   * AC-04.2 — the suspension must reach the user as its own message rather than
   * a generic sign-out. It travels as the session-lost reason now, which
   * SessionWatcher renders as the suspension copy; the backend's wording is no
   * longer read off a thrown error, because nothing is thrown.
   */
  it('ends a suspension with the reason that selects the suspension copy', async () => {
    server.use(http.get(SESSION_ENDPOINTS.session, sessionResponses.suspended))

    await expectDiscarded(sessionService.get())

    expect(reasons).toEqual(['ACCOUNT_SUSPENDED'])
  })
})
