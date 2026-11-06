import { HttpError } from '../../../shared/api/httpClient'
import { ERROR_CODES } from '../../../shared/api/constants'
import { USERS_ERROR_CODES } from './constants'

/**
 * Picks the i18n key to fall back to for a failed Users call.
 *
 * The backend returns its copy localised, and `getApiErrorMessage` prefers that
 * verbatim — this only decides what to show when the body carries no message
 * (a network failure, a non-JSON body, a bare 500).
 *
 * Note what is deliberately absent: a branch on the 403 *status*. On these
 * routes a 403 is either `ERR_ACCOUNT_SUSPENDED` — the caller themselves was
 * suspended, which `httpClient` handles by ending the session — or
 * `ERR_FORBIDDEN_PRIMARY`, which is just "that target is off-limits" and must
 * leave the session alone. Keying on the code rather than the status is what
 * stops a partner being logged out for clicking Delete on the account owner.
 */
export function usersErrorFallbackKey(error: unknown): string {
  if (!(error instanceof HttpError)) return 'common:errors.genericError'

  switch (error.code) {
    case USERS_ERROR_CODES.DUPLICATE_EMAIL:
      return 'users:errors.duplicateEmail'
    case USERS_ERROR_CODES.FORBIDDEN_PRIMARY:
      return 'users:errors.forbiddenPrimary'
    case ERROR_CODES.NOT_FOUND:
      return 'users:errors.notFound'
    case ERROR_CODES.VALIDATION:
      return 'users:errors.validation'
    default:
      return 'common:errors.genericError'
  }
}

/** True when the failure is the primary-user guard (BR-03), not a real error. */
export function isForbiddenPrimary(error: unknown): boolean {
  return error instanceof HttpError && error.code === USERS_ERROR_CODES.FORBIDDEN_PRIMARY
}
