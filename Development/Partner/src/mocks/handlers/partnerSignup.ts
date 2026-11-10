import { http } from 'msw'
import { SIGNUP_ENDPOINTS } from '../../app/modules/auth/constants'
import type {
  CompleteSignupDto,
  SignupEmailDto,
  VerifySignupCodeDto,
} from '../../app/modules/auth/types'
import { partnerSessionState } from '../data/partnerSession'
import {
  MOCK_REGISTERED_EMAIL,
  MOCK_SIGNUP_ACCESS_TOKEN,
  MOCK_SIGNUP_CODE,
  MOCK_THROTTLED_EMAIL,
  signupResponses,
} from '../data/partnerSignup'
import { rememberMockSignup } from '../../shared/auth/mockAuthProvider'

const normalise = (email: string) => email.trim().toLowerCase()

/** The email `verify` provisioned, so `complete` can attribute the password. */
let signedUpEmail: string | null = null

export function resetMockSignupState(): void {
  signedUpEmail = null
}

/**
 * The four owned signup endpoints (CR-51 revised). No Cognito call is mocked
 * because the client makes none during signup.
 *
 * `verify` provisions and logs in; `complete` is Bearer-authenticated and only
 * sets the password.
 */
export const partnerSignupHandlers = [
  http.post(SIGNUP_ENDPOINTS.start, async ({ request }) => {
    const { email } = (await request.json()) as SignupEmailDto
    if (normalise(email) === MOCK_REGISTERED_EMAIL) return signupResponses.alreadyRegistered()
    // MET-1280 — a fixed address rather than a failed-attempt counter, so the
    // throttle recovery stays reachable in the demo without a real partner
    // tripping into it. The real trigger is server-side state we do not model.
    if (normalise(email) === MOCK_THROTTLED_EMAIL) return signupResponses.throttled()
    return signupResponses.codeSent()
  }),

  http.post(SIGNUP_ENDPOINTS.resend, () => signupResponses.codeSent()),

  http.post(SIGNUP_ENDPOINTS.verify, async ({ request }) => {
    const { email, code } = (await request.json()) as VerifySignupCodeDto
    if (code !== MOCK_SIGNUP_CODE) return signupResponses.codeIncorrect()

    signedUpEmail = normalise(email)
    // A brand-new partner owns a DRAFT restaurant, so the session that follows
    // must route them to profile setup rather than the seeded live portal.
    partnerSessionState.route = 'PROFILE_SETUP'
    return signupResponses.verified({
      partnerUser: { id: 'pu-new', email: signedUpEmail, isPrimary: true },
    })
  }),

  http.post(SIGNUP_ENDPOINTS.complete, async ({ request }) => {
    // Authenticated by the token `verify` issued — a caller who never verified
    // has no token and is rejected, which is what closes the takeover hole.
    const auth = request.headers.get('Authorization')
    if (auth !== `Bearer ${MOCK_SIGNUP_ACCESS_TOKEN}` || !signedUpEmail) {
      return signupResponses.unauthenticated()
    }

    const { password } = (await request.json()) as CompleteSignupDto
    // Lets the demo partner sign in again after signing out.
    rememberMockSignup(signedUpEmail, password)
    return signupResponses.passwordSet()
  }),
]
