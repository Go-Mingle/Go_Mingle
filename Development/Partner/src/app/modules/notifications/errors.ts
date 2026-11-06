import { HttpError } from '../../../shared/api/httpClient'
import { ERROR_CODES } from '../../../shared/api/constants'
import { NOTIFICATION_ERROR_CODES } from './constants'

/**
 * Picks the i18n key to fall back to for a failed notifications call.
 *
 * The backend returns its copy localised and `getApiErrorMessage` prefers that
 * verbatim; this only decides what to show when the body carries no message.
 *
 * Branching is on the error **code**, never the status — 400 alone covers both
 * date-range cases, and they need different copy.
 */
export function notificationsErrorFallbackKey(error: unknown): string {
  if (!(error instanceof HttpError)) return 'common:errors.genericError'

  switch (error.code) {
    case NOTIFICATION_ERROR_CODES.DATE_RANGE_INCOMPLETE:
      return 'notifications:errors.dateRangeIncomplete'
    case NOTIFICATION_ERROR_CODES.DATE_RANGE_INVALID:
      return 'notifications:errors.dateRangeInvalid'
    case ERROR_CODES.VALIDATION:
      return 'notifications:errors.validation'
    case ERROR_CODES.NOT_FOUND:
      return 'notifications:errors.notFound'
    default:
      return 'common:errors.genericError'
  }
}

/**
 * True when a mark-read was refused because the row is gone — deleted, outside the
 * 90-day window, or another restaurant's.
 *
 * Not really a failure: the notification the partner clicked no longer exists, so the
 * list is stale. The caller re-reads rather than presenting an error panel.
 */
export function isNotificationNotFound(error: unknown): boolean {
  return error instanceof HttpError && error.code === ERROR_CODES.NOT_FOUND
}

/**
 * True for either date-range rejection.
 *
 * Both are prevented client-side — Apply stays disabled until both dates are set, and
 * future end dates are unselectable — so reaching this means something bypassed the UI
 * (a hand-edited URL, a later refactor). Surfaced as a toast on the filter rather than
 * blanking the list, since the previous results are still valid.
 */
export function isDateRangeError(error: unknown): boolean {
  if (!(error instanceof HttpError)) return false
  return (
    error.code === NOTIFICATION_ERROR_CODES.DATE_RANGE_INCOMPLETE ||
    error.code === NOTIFICATION_ERROR_CODES.DATE_RANGE_INVALID
  )
}
