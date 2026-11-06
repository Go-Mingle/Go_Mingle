import { HttpError } from '../../../../shared/api/httpClient'
import { ERROR_CODES } from '../../../../shared/api/constants'

/**
 * Picks the i18n key to fall back to for a failed reviews call.
 *
 * The backend returns its copy localised and `getApiErrorMessage` prefers that
 * verbatim; this only decides what to show when the body carries no message.
 *
 * Branching is on the error **code**, never the status — the same rule the rest of
 * the app follows. J6G defines no codes of its own (spec §4.3), and 401/403 never
 * reach here: `SessionWatcher` owns those and terminates the session.
 */
export function reviewsErrorFallbackKey(error: unknown): string {
  if (!(error instanceof HttpError)) return 'common:errors.genericError'

  if (error.code === ERROR_CODES.NOT_FOUND) {
    return 'restaurants:partnerReviews.errors.notFound'
  }
  return 'common:errors.genericError'
}

/**
 * True when the review detail 404'd.
 *
 * This is not really an error: it means an admin deleted the review, or it belongs
 * to another restaurant — the API returns the same 404 for both on purpose. The
 * recovery is to close the modal and re-read the list, not to show an alarming
 * panel, so the caller branches on this rather than on `isError`.
 */
export function isReviewNotFound(error: unknown): boolean {
  return error instanceof HttpError && error.code === ERROR_CODES.NOT_FOUND
}
