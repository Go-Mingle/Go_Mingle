import type { AuthErrorCode } from './types'

/** Thrown by every {@link PartnerAuthProvider} so call sites branch on `code`, not on SDK strings. */
export class AuthError extends Error {
  readonly code: AuthErrorCode

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'AuthError'
    this.code = code
  }
}
