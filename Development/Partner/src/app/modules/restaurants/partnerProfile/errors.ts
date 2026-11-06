import { HttpError } from '../../../../shared/api/httpClient'
import { ERROR_CODES } from '../../../../shared/api/constants'
import { PROFILE_ERROR_CODES } from './constants'
import type { SubmitBlockedDetails } from './types'

/**
 * Picks the i18n key to fall back to for a failed profile call.
 *
 * The backend returns its copy localised and `getApiErrorMessage` prefers that
 * verbatim; this only decides what to show when the body carries no message.
 *
 * Branching is on the error *code*, never the status — 409 alone covers three
 * different situations here (read-only while PENDING, the last-contact guard,
 * and submitting from the wrong state), and 403 could be a suspension that
 * `httpClient` handles by ending the session.
 */
export function profileErrorFallbackKey(error: unknown): string {
  if (!(error instanceof HttpError)) return 'common:errors.genericError'

  switch (error.code) {
    case PROFILE_ERROR_CODES.READ_ONLY:
      return 'restaurants:profile.errors.readOnly'
    case PROFILE_ERROR_CODES.LAST_CONTACT:
      return 'restaurants:profile.errors.lastContact'
    case PROFILE_ERROR_CODES.INVALID_STATE:
      return 'restaurants:profile.errors.invalidState'
    case PROFILE_ERROR_CODES.COVER_PHOTO_REQUIRED:
      return 'restaurants:profile.errors.coverPhotoRequired'
    case PROFILE_ERROR_CODES.PAYMENT_SEAM:
      return 'restaurants:profile.errors.paymentSeam'
    case ERROR_CODES.NOT_FOUND:
      return 'restaurants:profile.errors.contactNotFound'
    case ERROR_CODES.VALIDATION:
      return 'restaurants:profile.errors.validation'
    default:
      return 'common:errors.genericError'
  }
}

/** True when a write was refused because the profile is under review (BR-03). */
export function isProfileReadOnly(error: unknown): boolean {
  return error instanceof HttpError && error.code === PROFILE_ERROR_CODES.READ_ONLY
}

/**
 * True when the action was refused because the restaurant is in the wrong state
 * — submitting from PENDING, or saving a draft from ACTIVE.
 *
 * This means the page is **stale**, not that the partner did anything wrong: a
 * second tab already submitted, or an admin moved the application on. The
 * caller's job is to re-read rather than argue.
 */
export function isProfileInvalidState(error: unknown): boolean {
  return error instanceof HttpError && error.code === PROFILE_ERROR_CODES.INVALID_STATE
}

/**
 * Extracts the submission gate's three blockers from a failed submit.
 *
 * They arrive together in one 422 so every applicable message can be shown at
 * once — the partner should not have to discover them one submit at a time.
 * Returns null for anything that is not a gate failure.
 */
export function readSubmitBlockers(error: unknown): SubmitBlockedDetails | null {
  if (!(error instanceof HttpError) || error.code !== ERROR_CODES.VALIDATION) return null

  const details = (error.responseBody as { error?: { details?: SubmitBlockedDetails } } | null)
    ?.error?.details
  if (!details) return null

  const { missingFields, needsPayout, needsCoverPhoto } = details
  const hasAny =
    (Array.isArray(missingFields) && missingFields.length > 0) || !!needsPayout || !!needsCoverPhoto
  return hasAny
    ? {
        missingFields: Array.isArray(missingFields) ? missingFields : [],
        needsPayout: !!needsPayout,
        needsCoverPhoto: !!needsCoverPhoto,
      }
    : null
}
