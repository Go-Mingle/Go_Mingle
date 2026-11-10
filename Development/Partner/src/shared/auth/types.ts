/** The signed-in partner as the auth provider knows them (before the session call). */
export interface AuthIdentity {
  id: string
  email: string
  fullName: string
}

/**
 * The seam between the app and whatever issues partner tokens.
 *
 * Login is frontend-direct to the GoMingle-Partners Cognito pool (BR-02) — the
 * refresh token never transits our backend. Swapping the implementation is the
 * only change needed when DevOps provisions the pool.
 */
export interface PartnerAuthProvider {
  signIn(email: string, password: string): Promise<AuthIdentity>
  /** Synchronous — the HTTP layer needs a header value immediately. */
  getAccessToken(): string | null
  /** Exchanges the refresh token for a new access token. Rejects when it is dead. */
  refresh(): Promise<string>
  signOut(): Promise<void>
  getIdentity(): AuthIdentity | null

  /**
   * Starts a password reset — Cognito emails a 6-digit code (J2 BR-07).
   *
   * Resolves even for an unregistered address so the caller can show the same
   * confirmation either way; revealing which emails exist is an enumeration
   * leak (BR-08).
   */
  forgotPassword(email: string): Promise<void>

  /** Completes the reset. The code is only verified here, not on a separate step. */
  confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void>

  /**
   * In-app change for a signed-in partner. Keeps the session alive (BR-11).
   *
   * Rejects with `SAME_PASSWORD` when the new password matches the current one.
   */
  changePassword(currentPassword: string, newPassword: string): Promise<void>
}

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'USER_NOT_FOUND'
  | 'PASSWORD_RESET_REQUIRED'
  | 'REFRESH_FAILED'
  | 'INVALID_EMAIL'
  /**
   * A Partners-pool Pre-Authentication Lambda rejection — account locked,
   * account or restaurant suspended, or sign-in temporarily unavailable. The
   * Lambda authors the copy, so `AuthError.message` is shown verbatim.
   */
  | 'PRE_AUTH_REJECTED'
  | 'CODE_MISMATCH'
  | 'CODE_EXPIRED'
  | 'INVALID_PASSWORD'
  /**
   * The new password is the one already in use (MET-1290).
   *
   * Cognito's `ChangePassword` accepts an identical password, so this is our
   * rule, enforced by the provider rather than only by the calling modal.
   */
  | 'SAME_PASSWORD'
  | 'LIMIT_EXCEEDED'
  /** The pool/app-client is misconfigured or the SDK failed to load — our fault, not the partner's. */
  | 'CONFIG_ERROR'
  | 'NETWORK'
  | 'UNKNOWN'
