import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Breadcrumb, ErrorEvent } from '@sentry/react'
import type { PartnerSession } from '../../../app/modules/session/types'

/**
 * Mutable so a test can decide whether a DSN is configured. `initSentry` reads
 * it at call time, so no module reset is needed between cases.
 */
const mockEnv = { SENTRY_DSN: '', APP_VERSION: '4.2.0' }

vi.mock('../../../configs/env', () => ({ ENV: mockEnv }))

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  setUser: vi.fn(),
  setTags: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({ name: 'BrowserTracing' })),
}))

const Sentry = await import('@sentry/react')
const { initSentry, setSentryUser, clearSentryUser } = await import('../sentry')

/** Structurally a JWS, so `scrubTokens` recognises it. */
const JWT =
  'eyJhbGciOiJSUzI1NiIsImtpZCI6ImFiYyJ9.eyJzdWIiOiIxMjM0IiwiZXhwIjo5OTk5fQ.c2lnbmF0dXJlLWhlcmU'

const session: PartnerSession = {
  partnerUser: {
    id: 'user-1',
    fullName: 'Ayesha Khan',
    email: 'ayesha@example.com',
    designation: 'Owner',
    isPrimary: true,
  },
  restaurant: {
    id: 'rest-9',
    name: 'Kolachi',
    status: 'ACTIVE',
    payoutReady: true,
    coverImageUrl: null,
  },
  route: 'FULL_PORTAL',
}

/** The options object the last `Sentry.init` call received. */
function lastInitOptions() {
  const calls = vi.mocked(Sentry.init).mock.calls
  return calls[calls.length - 1][0]!
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEnv.SENTRY_DSN = ''
})

describe('initSentry', () => {
  /**
   * A DSN-less build must behave as though Sentry were not a dependency at all
   * — no global handlers, no fetch or history instrumentation, no breadcrumbs.
   */
  it('does not install the SDK when no DSN is configured', () => {
    initSentry()
    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('installs the SDK with the configured DSN', () => {
    mockEnv.SENTRY_DSN = 'https://key@sentry.io/1'
    initSentry()
    expect(Sentry.init).toHaveBeenCalledTimes(1)
    expect(lastInitOptions().dsn).toBe('https://key@sentry.io/1')
  })

  /** An issue that cannot be tied to a deploy cannot be triaged against one. */
  it('tags the release with the app version', () => {
    mockEnv.SENTRY_DSN = 'https://key@sentry.io/1'
    initSentry()
    expect(lastInitOptions().release).toBe('gomingle-partner-web@4.2.0')
  })

  it('enables browser tracing so navigation breadcrumbs are recorded', () => {
    mockEnv.SENTRY_DSN = 'https://key@sentry.io/1'
    initSentry()
    expect(Sentry.browserTracingIntegration).toHaveBeenCalled()
    expect(lastInitOptions().integrations).toHaveLength(1)
  })

  /**
   * Leaving this at the SDK default keeps `sentry-trace`/`baggage` off
   * cross-origin API calls, which the backend's CORS policy does not allow.
   */
  it('does not widen trace propagation to the API origin', () => {
    mockEnv.SENTRY_DSN = 'https://key@sentry.io/1'
    initSentry()
    expect(lastInitOptions().tracePropagationTargets).toBeUndefined()
  })

  it('does not enable session replay', () => {
    mockEnv.SENTRY_DSN = 'https://key@sentry.io/1'
    initSentry()
    const options = lastInitOptions()
    expect(options.replaysSessionSampleRate).toBeUndefined()
    expect(options.replaysOnErrorSampleRate).toBeUndefined()
  })

  // FE1 BR-11 — the backstop for anything a call site did not scrub itself.
  describe('token redaction (BR-11)', () => {
    beforeEach(() => {
      mockEnv.SENTRY_DSN = 'https://key@sentry.io/1'
      initSentry()
    })

    it('scrubs a token out of an outgoing event', () => {
      const event = {
        extra: { responseBody: `Bearer ${JWT}` },
      } as unknown as ErrorEvent
      const sent = lastInitOptions().beforeSend!(event, {}) as ErrorEvent
      expect(JSON.stringify(sent)).not.toContain('eyJ')
    })

    it('scrubs a token out of a breadcrumb', () => {
      const breadcrumb: Breadcrumb = { data: { authorization: JWT } }
      const kept = lastInitOptions().beforeBreadcrumb!(breadcrumb, {}) as Breadcrumb
      expect(JSON.stringify(kept)).not.toContain('eyJ')
    })
  })
})

describe('setSentryUser', () => {
  it('identifies the partner by id and email', () => {
    setSentryUser(session)
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'user-1', email: 'ayesha@example.com' })
  })

  /** Tenant tags are what let one broken restaurant be told from an outage. */
  it('tags the restaurant, its status and the resolved route', () => {
    setSentryUser(session)
    expect(Sentry.setTags).toHaveBeenCalledWith({
      restaurantId: 'rest-9',
      restaurantStatus: 'ACTIVE',
      partnerRoute: 'FULL_PORTAL',
      isPrimaryUser: 'true',
    })
  })

  it('records a non-primary user as such', () => {
    setSentryUser({
      ...session,
      partnerUser: { ...session.partnerUser, isPrimary: false },
    })
    expect(Sentry.setTags).toHaveBeenCalledWith(expect.objectContaining({ isPrimaryUser: 'false' }))
  })

  it('never sends a token, whatever the session carries', () => {
    setSentryUser(session)
    expect(JSON.stringify(vi.mocked(Sentry.setUser).mock.calls)).not.toContain('eyJ')
  })
})

describe('clearSentryUser', () => {
  /** The tab outlives the session; the next sign-in must start anonymous. */
  it('drops the user and every tenant tag', () => {
    clearSentryUser()
    expect(Sentry.setUser).toHaveBeenCalledWith(null)
    expect(Sentry.setTags).toHaveBeenCalledWith({
      restaurantId: undefined,
      restaurantStatus: undefined,
      partnerRoute: undefined,
      isPrimaryUser: undefined,
    })
  })
})
