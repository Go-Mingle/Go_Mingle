import { HttpError } from '../../../../shared/api/httpClient'
import { ERROR_CODES } from '../../../../shared/api/constants'
import { PROFILE_ERROR_CODES } from '../partnerProfile/constants'
import { TABLES_ERROR_CODES } from './constants'

/**
 * Picks the i18n key to fall back to for a failed tables call.
 *
 * The backend returns its copy localised and `getApiErrorMessage` prefers that
 * verbatim; this only decides what to show when the body carries no message.
 *
 * Branching is on the error **code**, never the status. On this tab 409 alone
 * covers three entirely different situations — the profile is under review, the
 * name is taken, or the table is committed to an upcoming interest table — and
 * only the last two are things the partner can act on. A 401 or a suspension
 * never reaches here at all: `httpClient`'s session policy ends the session
 * instead of surfacing them.
 */
export function tablesErrorFallbackKey(error: unknown): string {
  if (!(error instanceof HttpError)) return 'common:errors.genericError'

  switch (error.code) {
    case PROFILE_ERROR_CODES.READ_ONLY:
      return 'restaurants:partnerTables.errors.readOnly'
    case TABLES_ERROR_CODES.NAME_DUPLICATE:
      return 'restaurants:partnerTables.errors.nameDuplicate'
    case TABLES_ERROR_CODES.IN_USE:
      return 'restaurants:partnerTables.errors.inUse'
    case ERROR_CODES.NOT_FOUND:
      return 'restaurants:partnerTables.errors.notFound'
    case ERROR_CODES.VALIDATION:
      return 'restaurants:partnerTables.errors.validation'
    default:
      return 'common:errors.genericError'
  }
}

/**
 * True when a create or rename collided with another non-deleted table (BR-03).
 *
 * Comparison is case-insensitive server-side, so "Garden Patio" and "garden
 * patio" collide — which is why this is worth showing on the field rather than as
 * a toast the partner has to reconcile against what they typed.
 */
export function isTableNameDuplicate(error: unknown): boolean {
  return error instanceof HttpError && error.code === TABLES_ERROR_CODES.NAME_DUPLICATE
}

/**
 * True when a delete was refused because the table is assigned to an interest
 * table that has not completed or been cancelled (BR-09).
 *
 * The recovery is to **hide** the table instead, so this opens an offer rather
 * than reporting a failure. It becomes deletable on its own once those interest
 * tables end.
 */
export function isTableInUse(error: unknown): boolean {
  return error instanceof HttpError && error.code === TABLES_ERROR_CODES.IN_USE
}

/**
 * True when the table is gone — deleted in another tab, or never belonged to this
 * restaurant (the two are indistinguishable by design).
 *
 * A stale-view message rather than an error the partner can act on; the list is
 * re-read either way.
 */
export function isTableMissing(error: unknown): boolean {
  return error instanceof HttpError && error.code === ERROR_CODES.NOT_FOUND
}
