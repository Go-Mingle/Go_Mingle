import { HttpError } from '../../../../shared/api/httpClient'
import { ERROR_CODES } from '../../../../shared/api/constants'
import { PROFILE_ERROR_CODES } from '../partnerProfile/constants'
import { MEDIA_ERROR_CODES } from './constants'
import type { MediaKind } from './types'

/**
 * Picks the i18n key to fall back to for a failed media call.
 *
 * The backend returns its copy localised and `getApiErrorMessage` prefers that
 * verbatim; this only decides what to show when the body carries no message.
 *
 * Branching is on the error **code**, never the status — 409 alone covers four
 * different situations here (read-only while PENDING, the count limit, the
 * cover-reassign guard, and a wrong-state write), and they need different copy.
 */
export function mediaErrorFallbackKey(error: unknown, kind: MediaKind): string {
  if (!(error instanceof HttpError)) return 'common:errors.genericError'

  switch (error.code) {
    case PROFILE_ERROR_CODES.READ_ONLY:
      return 'restaurants:partnerMedia.errors.readOnly'
    case MEDIA_ERROR_CODES.LIMIT_REACHED:
      // Copy names the kind: "maximum number of photos" reads better than a
      // generic limit message when three limits exist on one screen.
      return `restaurants:partnerMedia.errors.limitReached.${kind}`
    case MEDIA_ERROR_CODES.TOO_LARGE:
      return `restaurants:partnerMedia.errors.tooLarge.${kind}`
    case MEDIA_ERROR_CODES.BAD_TYPE:
      return `restaurants:partnerMedia.errors.badType.${kind}`
    case MEDIA_ERROR_CODES.COVER_REASSIGN:
      return 'restaurants:partnerMedia.errors.coverReassign'
    case MEDIA_ERROR_CODES.VIDEO_PROVIDER:
      return 'restaurants:partnerMedia.errors.videoProvider'
    case ERROR_CODES.NOT_FOUND:
      return `restaurants:partnerMedia.errors.notFound.${kind}`
    case ERROR_CODES.VALIDATION:
      return 'restaurants:partnerMedia.errors.validation'
    default:
      return 'common:errors.genericError'
  }
}

/**
 * True when a delete was refused because the photo is the current cover and
 * others exist (BR-11). The recovery is to designate a replacement first, so
 * this reads as an instruction rather than a failure.
 */
export function isCoverReassignRequired(error: unknown): boolean {
  return error instanceof HttpError && error.code === MEDIA_ERROR_CODES.COVER_REASSIGN
}

/** True when the write was refused because the profile is under review (BR-13). */
export function isMediaReadOnly(error: unknown): boolean {
  return error instanceof HttpError && error.code === PROFILE_ERROR_CODES.READ_ONLY
}

/**
 * True when the count limit was hit. Raised at step 1, before an upload target
 * is issued, so no bytes are ever sent for a refused upload.
 */
export function isMediaLimitReached(error: unknown): boolean {
  return error instanceof HttpError && error.code === MEDIA_ERROR_CODES.LIMIT_REACHED
}
