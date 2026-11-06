import { HttpError } from '../../../../shared/api/httpClient'
import { ERROR_CODES } from '../../../../shared/api/constants'
import { PROFILE_ERROR_CODES } from '../partnerProfile/constants'
import { IT_ERROR_CODES } from './constants'

/**
 * Picks the i18n key to fall back to for a failed interest-tables call.
 *
 * The backend returns its copy localised and `getApiErrorMessage` prefers that
 * verbatim; this decides what to show when the body carries no message.
 *
 * Branching is on the error **code**, never the status — 409 alone covers four
 * different situations on this surface (the booking is terminal, it is a
 * Promingler booking, the invite is no longer Invited, or the restaurant is not
 * ACTIVE) and only some of them are the partner's to fix.
 *
 * Known gap, tracked: the backend currently returns a generic "Invalid request"
 * message for `ERR_BOOKING_NOT_CANCELLABLE` and `ERR_INVITE_NOT_CANCELLABLE`.
 * Since the repo prefers the server's wording, those two will read "Invalid
 * request" until that is fixed — at which point the correct copy appears with no
 * client change. The keys below are already right.
 */
export function interestTablesErrorFallbackKey(error: unknown): string {
  if (!(error instanceof HttpError)) return 'common:errors.genericError'

  switch (error.code) {
    case IT_ERROR_CODES.BOOKING_NOT_CANCELLABLE:
      return 'restaurants:partnerInterestTables.errors.bookingNotCancellable'
    case IT_ERROR_CODES.PROMINGLER_BOOKING:
    case IT_ERROR_CODES.PROMINGLER_BOOKING_SHORT:
      return 'restaurants:partnerInterestTables.errors.prominglerBooking'
    case IT_ERROR_CODES.INVITE_NOT_CANCELLABLE:
      return 'restaurants:partnerInterestTables.errors.inviteNotCancellable'
    case PROFILE_ERROR_CODES.READ_ONLY:
      return 'restaurants:partnerInterestTables.errors.readOnly'
    case ERROR_CODES.NOT_FOUND:
      return 'restaurants:partnerInterestTables.errors.notFound'
    default:
      return 'common:errors.genericError'
  }
}

/**
 * True when the booking is already terminal, or awaiting a charge retry (BR-05).
 *
 * `details.status` carries the state that blocked it.
 */
export function isBookingNotCancellable(error: unknown): boolean {
  return error instanceof HttpError && error.code === IT_ERROR_CODES.BOOKING_NOT_CANCELLABLE
}

/**
 * True when the refusal is because it is a Promingler booking (BR-05).
 *
 * Matches **both** code spellings: the spec documents `ERR_PROMINGLER_BOOKING`,
 * the backend confirmed it ships `ERR_PROMINGLER_BOOKING_NOT_CANCELLABLE`.
 * Promingler changes go through the admin Change-Promingler flow instead.
 */
export function isProminglerBooking(error: unknown): boolean {
  if (!(error instanceof HttpError)) return false
  return (
    error.code === IT_ERROR_CODES.PROMINGLER_BOOKING ||
    error.code === IT_ERROR_CODES.PROMINGLER_BOOKING_SHORT
  )
}

/** True when the invite is Table Booked or already Cancelled (BR-06). */
export function isInviteNotCancellable(error: unknown): boolean {
  return error instanceof HttpError && error.code === IT_ERROR_CODES.INVITE_NOT_CANCELLABLE
}

/**
 * True when the write was refused because the restaurant is not ACTIVE (BR-07).
 *
 * Reachable even though the UI hides both × buttons outside ACTIVE: the profile
 * can change state in another tab while this one is open.
 */
export function isInterestTablesReadOnly(error: unknown): boolean {
  return error instanceof HttpError && error.code === PROFILE_ERROR_CODES.READ_ONLY
}

/**
 * True when the resource is not addressable — a Draft interest table, another
 * restaurant's data, or an unknown id. Indistinguishable by design (BR-03/BR-04).
 *
 * On the detail page this is a **"not found" view**, not an error state: a Draft
 * deep link is an expected outcome, not a failure.
 */
export function isNotFound(error: unknown): boolean {
  return error instanceof HttpError && error.code === ERROR_CODES.NOT_FOUND
}

/**
 * The state that blocked a cancellation, from `details.status` (bookings) or
 * `details.inviteStatus` (invites).
 *
 * Returns null when absent, so the caller can fall back to copy that does not
 * name a state rather than printing "undefined".
 */
export function blockedState(error: unknown): string | null {
  if (!(error instanceof HttpError)) return null

  const details = (
    error.responseBody as {
      error?: { details?: { status?: unknown; inviteStatus?: unknown } }
    } | null
  )?.error?.details
  const state = details?.status ?? details?.inviteStatus

  return typeof state === 'string' && state.trim() ? state : null
}
