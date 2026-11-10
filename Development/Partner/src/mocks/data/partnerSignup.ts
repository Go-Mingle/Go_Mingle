import { HttpResponse } from 'msw'
import type { VerifySignupCodeResponse } from '../../app/modules/auth/types'

/** The code the mock accepts; anything else exercises the 422 path. */
export const MOCK_SIGNUP_CODE = '123456'
/** Signing up with this address exercises the already-registered path. */
export const MOCK_REGISTERED_EMAIL = 'partner@gomingle.com'
/** Signing up with this address exercises the Cognito throttle path (MET-1280). */
export const MOCK_THROTTLED_EMAIL = 'throttled@gomingle.com'
/** The access token `verify` issues, which then authorises `complete`. */
export const MOCK_SIGNUP_ACCESS_TOKEN = 'signup-access-token'

const TWO_HOURS_SECONDS = 7200

/**
 * What `verify` returns (CR-51 revised): the account is provisioned and the
 * partner is logged in from here, so the session arrives at this step rather
 * than at `complete`.
 *
 * `restaurant.name` is deliberately absent — the real backend creates it with
 * `name: ''` because the column is NOT NULL, and the portal treats empty as unset.
 */
export const mockSignupAccount: VerifySignupCodeResponse = {
  partnerUser: { id: 'pu-new', email: 'new@aurelia.pk', isPrimary: true },
  restaurant: { id: 'restDraft', status: 'DRAFT' },
  route: 'PROFILE_SETUP',
  session: {
    accessToken: MOCK_SIGNUP_ACCESS_TOKEN,
    refreshToken: 'signup-refresh-token',
    idToken: 'signup-id-token',
    expiresIn: TWO_HOURS_SECONDS,
    tokenType: 'Bearer',
  },
}

function errorEnvelope(code: string, message: string, status: number) {
  return HttpResponse.json({ success: false, error: { code, message } }, { status })
}

export const signupResponses = {
  /** `start` and `resend` both just acknowledge the emailed code. */
  codeSent: () => HttpResponse.json({ success: true, data: { codeSent: true } }),

  /** 201 — the account now exists and the caller is authenticated. */
  verified: (overrides: Partial<VerifySignupCodeResponse> = {}) =>
    HttpResponse.json(
      { success: true, data: { ...mockSignupAccount, ...overrides } },
      { status: 201 },
    ),

  /** 200 — `complete` only reports that the password was set. */
  passwordSet: () => HttpResponse.json({ success: true, data: { passwordSet: true } }),

  /** Raised by `start` (confirmed email) and `verify` (spent code / already confirmed). */
  alreadyRegistered: () =>
    errorEnvelope('ERR_ALREADY_REGISTERED', 'This account already exists. Please sign in.', 409),

  /** `resend` inside the server-enforced 60s window. */
  resendCooldown: () =>
    errorEnvelope('ERR_RESET_CODE_COOLDOWN', 'Please wait before requesting another code.', 429),

  /**
   * A pool-level Cognito limit on `start` or `resend` — the throttle MET-1280
   * asks the backend to map, rather than let escape as a 500. Distinct from
   * `resendCooldown`, which is our own 60s window and carries its own code, so
   * the client has to recognise this by status.
   */
  throttled: () =>
    errorEnvelope('ERR_TOO_MANY_REQUESTS', 'Too many attempts. Please try again later.', 429),

  codeIncorrect: () =>
    errorEnvelope('ERR_VALIDATION', 'That code is incorrect. Check it and try again.', 422),

  codeExpired: () =>
    errorEnvelope('ERR_VALIDATION', 'This code has expired. Request a new one.', 422),

  /**
   * `verify` — the signup went idle (about an hour). Same status and code as a
   * wrong code, so only the message distinguishes them.
   */
  signupSessionExpired: () =>
    errorEnvelope('ERR_VALIDATION', 'This signup session has expired. Please start again.', 422),

  passwordRejected: () =>
    errorEnvelope(
      'ERR_VALIDATION',
      'At least 8 characters, plus an uppercase letter, number, or symbol.',
      422,
    ),

  /** `complete` without the Bearer token issued by `verify`. */
  unauthenticated: () => errorEnvelope('ERR_TOKEN_INVALID', 'Authentication required.', 401),

  unavailable: () =>
    errorEnvelope('ERR_SERVICE_UNAVAILABLE', 'Something went wrong. Please try again.', 503),

  internal: () => errorEnvelope('ERR_INTERNAL', 'Something went wrong. Please try again.', 500),
}
