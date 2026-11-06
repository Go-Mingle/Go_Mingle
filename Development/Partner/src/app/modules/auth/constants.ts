export const AUTH_ENDPOINTS = {
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  requestOtp: '/api/auth/otp/request',
  verifyOtp: '/api/auth/otp/verify',
} as const

/**
 * Signup is fully backend-orchestrated (CR-51). Every Cognito call — SignUp,
 * ConfirmSignUp, ResendConfirmationCode and the auto-login — happens
 * server-side, so the client makes no Cognito SDK calls during signup and the
 * pool's app-client id is not needed in the browser for it.
 *
 * `verify` returns the session tokens directly, so there is no separate login
 * step and no client-supplied proof artifact. `complete` is then a
 * Bearer-authenticated call that only sets the password, which is why a 401 from
 * it is a real session loss (see PARTNER_PORTAL_J1_SIGNUP.md §4.1).
 */
export const SIGNUP_ENDPOINTS = {
  start: '/api/v1/partner/signup/start',
  resend: '/api/v1/partner/signup/resend',
  verify: '/api/v1/partner/signup/verify',
  complete: '/api/v1/partner/signup/complete',
} as const

export const OTP_LENGTH = 6
/** BR-03 — the visible resend cooldown on the code step. */
export const SIGNUP_RESEND_COOLDOWN_SECONDS = 60
export const OTP_RESEND_COOLDOWN_SECONDS = 30
export const PASSWORD_MIN_LENGTH = 8
