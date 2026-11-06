import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { http } from 'msw'
import { server } from '../../../../mocks/server'
import {
  MOCK_REGISTERED_EMAIL,
  MOCK_SIGNUP_ACCESS_TOKEN,
  MOCK_SIGNUP_CODE,
  mockSignupAccount,
  signupResponses,
} from '../../../../mocks/data/partnerSignup'
import { HttpError } from '../../../../shared/api/httpClient'
import { __clearSessionListeners, onSessionLost } from '../../../../shared/auth/sessionEvents'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { expectDiscarded } from '../../../../test-utils/expectDiscarded'
import { SIGNUP_ENDPOINTS } from '../constants'
import { signupService } from '../signupService'

const EMAIL = 'new@aurelia.pk'

afterEach(() => {
  __clearSessionListeners()
})

describe('signupService.start', () => {
  it('requests the code and reports it sent', async () => {
    const result = await signupService.start({ email: EMAIL })
    expect(result.codeSent).toBe(true)
  })

  it('sends only the email', async () => {
    let body: unknown
    server.use(
      http.post(SIGNUP_ENDPOINTS.start, async ({ request }) => {
        body = await request.json()
        return signupResponses.codeSent()
      }),
    )

    await signupService.start({ email: EMAIL })

    expect(body).toEqual({ email: EMAIL })
  })

  it('reports an already-registered email as 409', async () => {
    // Detected here first — before any code is emailed.
    const error = (await signupService
      .start({ email: MOCK_REGISTERED_EMAIL })
      .catch((e: unknown) => e)) as HttpError

    expect(error).toBeInstanceOf(HttpError)
    expect(error.status).toBe(409)
    expect(error.code).toBe('ERR_ALREADY_REGISTERED')
  })

  it('reports a transient outage as 503', async () => {
    server.use(http.post(SIGNUP_ENDPOINTS.start, signupResponses.unavailable))

    const error = (await signupService
      .start({ email: EMAIL })
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(503)
    expect(error.code).toBe('ERR_SERVICE_UNAVAILABLE')
  })
})

describe('signupService.resend', () => {
  it('re-issues the code', async () => {
    const result = await signupService.resend({ email: EMAIL })
    expect(result.codeSent).toBe(true)
  })

  it('reports the server-enforced cooldown as 429', async () => {
    server.use(http.post(SIGNUP_ENDPOINTS.resend, signupResponses.resendCooldown))

    const error = (await signupService
      .resend({ email: EMAIL })
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(429)
    expect(error.code).toBe('ERR_RESET_CODE_COOLDOWN')
  })
})

describe('signupService.verify', () => {
  it('provisions the account and returns the session', async () => {
    const account = await signupService.verify({ email: EMAIL, code: MOCK_SIGNUP_CODE })

    expect(account.route).toBe('PROFILE_SETUP')
    expect(account.restaurant.status).toBe('DRAFT')
    // The partner is logged in from here — this is the only way to get a token
    // before a password exists, and `complete` requires it.
    expect(account.session.accessToken).toBe(MOCK_SIGNUP_ACCESS_TOKEN)
    expect(account.session.refreshToken).toBe(mockSignupAccount.session.refreshToken)
    expect(account.session.expiresIn).toBe(7200)
    expect(account.session.tokenType).toBe('Bearer')
  })

  it('sends exactly the email and the code', async () => {
    let body: unknown
    server.use(
      http.post(SIGNUP_ENDPOINTS.verify, async ({ request }) => {
        body = await request.json()
        return signupResponses.verified()
      }),
    )

    await signupService.verify({ email: EMAIL, code: MOCK_SIGNUP_CODE })

    expect(body).toEqual({ email: EMAIL, code: MOCK_SIGNUP_CODE })
  })

  it('surfaces the backend wording for an incorrect code', async () => {
    const error = (await signupService
      .verify({ email: EMAIL, code: '000000' })
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(422)
    expect(error.responseBody).toMatchObject({
      error: { message: 'That code is incorrect. Check it and try again.' },
    })
  })

  it('surfaces the distinct wording for an expired code', async () => {
    server.use(http.post(SIGNUP_ENDPOINTS.verify, signupResponses.codeExpired))

    const error = (await signupService
      .verify({ email: EMAIL, code: MOCK_SIGNUP_CODE })
      .catch((e: unknown) => e)) as HttpError

    expect(error.responseBody).toMatchObject({
      error: { message: 'This code has expired. Request a new one.' },
    })
  })

  it('reports an idle signup session as a 422 distinguishable only by message', async () => {
    server.use(http.post(SIGNUP_ENDPOINTS.verify, signupResponses.signupSessionExpired))

    const error = (await signupService
      .verify({ email: EMAIL, code: MOCK_SIGNUP_CODE })
      .catch((e: unknown) => e)) as HttpError

    // Same status and code as a wrong code — the code was never consumed.
    expect(error.status).toBe(422)
    expect(error.code).toBe('ERR_VALIDATION')
    expect(error.responseBody).toMatchObject({
      error: { message: 'This signup session has expired. Please start again.' },
    })
  })

  it('reports a spent code or already-confirmed account as 409', async () => {
    server.use(http.post(SIGNUP_ENDPOINTS.verify, signupResponses.alreadyRegistered))

    const error = (await signupService
      .verify({ email: EMAIL, code: MOCK_SIGNUP_CODE })
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(409)
    expect(error.code).toBe('ERR_ALREADY_REGISTERED')
  })
})

describe('signupService.complete', () => {
  /** `verify` first, then hold its token the way the flow does. */
  async function verifyAndHoldSession() {
    const account = await signupService.verify({ email: EMAIL, code: MOCK_SIGNUP_CODE })
    tokenStore.setTokens({
      accessToken: account.session.accessToken,
      refreshToken: account.session.refreshToken,
      expiresAt: Date.now() + account.session.expiresIn * 1000,
    })
  }

  beforeEach(() => {
    tokenStore.clear()
  })

  it('sets the password for the authenticated caller', async () => {
    await verifyAndHoldSession()

    const result = await signupService.complete({ password: 'aurelia1' })

    expect(result.passwordSet).toBe(true)
  })

  it('sends only the password — no email, no confirmPassword', async () => {
    await verifyAndHoldSession()
    let body: Record<string, unknown> = {}
    server.use(
      http.post(SIGNUP_ENDPOINTS.complete, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return signupResponses.passwordSet()
      }),
    )

    await signupService.complete({ password: 'aurelia1' })

    // The email comes from the token; sending it is a 422, not ignored.
    expect(Object.keys(body)).toEqual(['password'])
  })

  it('sends the bearer token issued by verify', async () => {
    await verifyAndHoldSession()
    let auth: string | null = null
    server.use(
      http.post(SIGNUP_ENDPOINTS.complete, ({ request }) => {
        auth = request.headers.get('Authorization')
        return signupResponses.passwordSet()
      }),
    )

    await signupService.complete({ password: 'aurelia1' })

    expect(auth).toBe(`Bearer ${MOCK_SIGNUP_ACCESS_TOKEN}`)
  })

  it('is rejected without that token — the takeover path', async () => {
    // A caller who never verified holds no token, so cannot finish an account
    // someone else started (CR-51 AC-6).
    const error = (await signupService
      .complete({ password: 'aurelia1' })
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(401)
    expect(error.code).toBe('ERR_TOKEN_INVALID')
  })

  it('treats a 401 here as a genuine session loss', async () => {
    // Unlike the pre-CR-51 flow, the partner really is signed in by now, so
    // `complete` runs on the ordinary httpClient and the session policy applies.
    const reasons: string[] = []
    onSessionLost((reason) => reasons.push(reason))
    tokenStore.setTokens({ accessToken: 'stale', refreshToken: 'r', expiresAt: 1 })

    // Discarded rather than rejected (FE1 BR-07) — the session-lost event is
    // what the partner sees, not an error toast from this call site.
    await expectDiscarded(signupService.complete({ password: 'aurelia1' }))

    expect(reasons).toEqual(['TOKEN_INVALID'])
    expect(tokenStore.hasSession()).toBe(false)
  })

  it('reports a rejected password as 422 with the rule', async () => {
    await verifyAndHoldSession()
    server.use(http.post(SIGNUP_ENDPOINTS.complete, signupResponses.passwordRejected))

    const error = (await signupService
      .complete({ password: 'short' })
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(422)
    expect(error.responseBody).toMatchObject({
      error: { message: 'At least 8 characters, plus an uppercase letter, number, or symbol.' },
    })
  })

  it('is safe to retry — it just re-sets the password', async () => {
    await verifyAndHoldSession()

    await expect(signupService.complete({ password: 'aurelia1' })).resolves.toMatchObject({
      passwordSet: true,
    })
    await expect(signupService.complete({ password: 'aurelia1' })).resolves.toMatchObject({
      passwordSet: true,
    })
    // The session is untouched by setting the password.
    expect(tokenStore.hasSession()).toBe(true)
  })
})
