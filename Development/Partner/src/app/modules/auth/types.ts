export interface LoginDto {
  email: string
  password: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  initials: string
  color?: string
}

export interface AuthTokenResponse {
  token: string
  user: AuthUser
}

export interface RequestOtpDto {
  email: string
}

export interface VerifyOtpDto {
  email: string
  otp: string
}

// ── Signup (backend-orchestrated, CR-51 revised) ──────────────

export interface SignupEmailDto {
  email: string
}

/** `start` and `resend` both just acknowledge that Cognito emailed the code. */
export interface SignupCodeSentResponse {
  codeSent: boolean
}

export interface VerifySignupCodeDto {
  email: string
  code: string
}

/** The session the backend issues; the partner is logged in from `verify` onward. */
export interface SignupSession {
  accessToken: string
  refreshToken: string
  idToken: string
  /** Seconds until the access token expires. */
  expiresIn: number
  tokenType: string
}

/**
 * `verify` is where the account is provisioned and the partner is logged in
 * (CR-51 revised, 201). Possession of the emailed code is the caller-bound gate,
 * and the tokens it returns are what authorise `complete` — which is why there is
 * no unclaimed account for an attacker to seize.
 */
export interface VerifySignupCodeResponse {
  partnerUser: { id: string; email: string; isPrimary: boolean }
  restaurant: { id: string; status: 'DRAFT' }
  route: 'PROFILE_SETUP'
  session: SignupSession
}

/**
 * Password only. `complete` is Bearer-authenticated now, so the email comes from
 * the token — sending it is rejected with a 422, not ignored, and so is
 * `confirmPassword`. The confirm-password match stays client-side.
 */
export interface CompleteSignupDto {
  password: string
}

export interface CompleteSignupResponse {
  passwordSet: boolean
}
