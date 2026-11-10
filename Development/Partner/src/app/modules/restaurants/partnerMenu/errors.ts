import { HttpError } from '../../../../shared/api/httpClient'
import { ERROR_CODES } from '../../../../shared/api/constants'
import { PROFILE_ERROR_CODES } from '../partnerProfile/constants'
import { MEDIA_ERROR_CODES } from '../partnerMedia/constants'
import { MENU_ERROR_CODES } from './constants'

/**
 * Picks the i18n key to fall back to for a failed menu call.
 *
 * The backend returns its copy localised and `getApiErrorMessage` prefers that
 * verbatim; this only decides what to show when the body carries no message.
 *
 * Branching is on the error **code**, never the status. On this tab 409 alone
 * covers two entirely different situations — the profile is under review, or the
 * combo is committed to an upcoming interest table — and the second one is not
 * really a failure at all but an instruction to hide instead.
 */
export function menuErrorFallbackKey(error: unknown): string {
  if (!(error instanceof HttpError)) return 'common:errors.genericError'

  switch (error.code) {
    case PROFILE_ERROR_CODES.READ_ONLY:
      return 'restaurants:partnerMenu.errors.readOnly'
    case MENU_ERROR_CODES.IN_USE:
      return 'restaurants:partnerMenu.errors.inUse'
    // Reused from J6B: the menu PDF shares the document size limit and the
    // PDF-only type check.
    case MEDIA_ERROR_CODES.TOO_LARGE:
      return 'restaurants:partnerMenu.errors.tooLarge'
    case MEDIA_ERROR_CODES.BAD_TYPE:
      return 'restaurants:partnerMenu.errors.badType'
    case ERROR_CODES.NOT_FOUND:
      return 'restaurants:partnerMenu.errors.notFound'
    case ERROR_CODES.VALIDATION:
      return 'restaurants:partnerMenu.errors.validation'
    default:
      return 'common:errors.genericError'
  }
}

/**
 * True when a delete was refused because the combo is attached to an interest
 * table that has not completed or been cancelled (BR-09).
 *
 * The recovery is to **hide** the combo instead, so this opens an offer rather
 * than reporting a failure.
 */
export function isMenuOptionInUse(error: unknown): boolean {
  return error instanceof HttpError && error.code === MENU_ERROR_CODES.IN_USE
}

/**
 * How many upcoming interest tables are holding the combo, from
 * `details.upcomingTables`.
 *
 * Re-exported rather than defined here: J6E's `ERR_TABLE_IN_USE` sends the same
 * detail, so the reader lives in `shared/utils/apiError`. Kept on this module's
 * surface so J6D's call sites and tests read unchanged.
 */
export { upcomingTablesCount } from '../../../../shared/utils/apiError'

/**
 * True when a PDF delete found nothing to remove.
 *
 * Reachable by double-clicking delete, or by deleting in another tab first — so
 * it is a stale-view message ("No menu PDF to remove.") rather than an error the
 * partner can act on.
 */
export function isMenuPdfMissing(error: unknown): boolean {
  return error instanceof HttpError && error.code === ERROR_CODES.NOT_FOUND
}
