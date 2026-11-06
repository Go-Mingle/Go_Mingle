import { HttpError } from '../../../shared/api/httpClient'
import { ERROR_CODES } from '../../../shared/api/constants'
import { WEBHOOK_ERROR_CODES } from './constants'

/**
 * Picks the i18n key to fall back to for a failed webhook call.
 *
 * The backend returns its copy localised and `getApiErrorMessage` prefers that
 * verbatim; this only decides what to show when the body carries no message —
 * a network failure, a non-JSON body, a bare 500.
 *
 * As on J3's routes, the branch is on the error *code*, never the status: a 403
 * here means `ERR_ACCOUNT_SUSPENDED` and `httpClient` ends the session, whereas
 * `ERR_NOT_CONFIGURED` is a 409 precondition that must leave it alone.
 */
export function webhookErrorFallbackKey(error: unknown): string {
  if (!(error instanceof HttpError)) return 'common:errors.genericError'

  switch (error.code) {
    case WEBHOOK_ERROR_CODES.NOT_CONFIGURED:
      return 'integrations:errors.notConfigured'
    case ERROR_CODES.VALIDATION:
      return 'integrations:errors.validation'
    default:
      return 'common:errors.genericError'
  }
}
