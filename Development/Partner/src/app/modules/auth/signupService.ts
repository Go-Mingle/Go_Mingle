import { httpClient, publicHttpClient } from '../../../shared/api/httpClient'
import { SIGNUP_ENDPOINTS } from './constants'
import type {
  CompleteSignupDto,
  CompleteSignupResponse,
  SignupCodeSentResponse,
  SignupEmailDto,
  VerifySignupCodeDto,
  VerifySignupCodeResponse,
} from './types'

/**
 * The four owned signup endpoints (CR-51 revised). Every Cognito call sits behind
 * them, so the client makes none during signup.
 *
 * The split between the two clients is deliberate. `start`, `resend` and `verify`
 * run before any session exists and go through `publicHttpClient`, which skips
 * the session policy. `complete` runs *after* `verify` has logged the partner in,
 * so it goes through the ordinary `httpClient`: it needs the Bearer token, and a
 * 401 there really does mean the session is bad.
 */
export const signupService = {
  /** Creates the UNCONFIRMED user server-side and emails the 6-digit code. */
  start: (data: SignupEmailDto): Promise<SignupCodeSentResponse> =>
    publicHttpClient.post<SignupCodeSentResponse>(SIGNUP_ENDPOINTS.start, data),

  /** Re-issues the code. The 60s cooldown is enforced server-side as well. */
  resend: (data: SignupEmailDto): Promise<SignupCodeSentResponse> =>
    publicHttpClient.post<SignupCodeSentResponse>(SIGNUP_ENDPOINTS.resend, data),

  /**
   * Confirms the code, provisions the account plus the empty DRAFT restaurant,
   * and logs the partner in — the session comes back from here, not from
   * `complete`. Possession of the emailed code is what earns it.
   */
  verify: (data: VerifySignupCodeDto): Promise<VerifySignupCodeResponse> =>
    publicHttpClient.post<VerifySignupCodeResponse>(SIGNUP_ENDPOINTS.verify, data),

  /**
   * Sets the authenticated caller's real password. Password only — the email
   * comes from the token. Safe to retry; it just re-sets the password, and the
   * session stays valid either way.
   */
  complete: (data: CompleteSignupDto): Promise<CompleteSignupResponse> =>
    httpClient.post<CompleteSignupResponse>(SIGNUP_ENDPOINTS.complete, data),
}
