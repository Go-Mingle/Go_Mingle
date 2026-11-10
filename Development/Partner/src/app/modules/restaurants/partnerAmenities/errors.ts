import { HttpError } from '../../../../shared/api/httpClient'
import { ERROR_CODES } from '../../../../shared/api/constants'
import { PROFILE_ERROR_CODES } from '../partnerProfile/constants'

/**
 * Picks the i18n key to fall back to for a failed amenity call.
 *
 * The backend returns its copy localised and `getApiErrorMessage` prefers that
 * verbatim; this only decides what to show when the body carries no message.
 *
 * Branching is on the error **code**, never the status: J6C reuses J6A's
 * `ERR_PROFILE_READ_ONLY` for a write while PENDING, and its 404 means something
 * quite specific — the amenity was retired from the catalogue since the list
 * loaded, which needs different copy from a generic failure.
 */
export function amenityErrorFallbackKey(error: unknown): string {
  if (!(error instanceof HttpError)) return 'common:errors.genericError'

  switch (error.code) {
    case PROFILE_ERROR_CODES.READ_ONLY:
      return 'restaurants:partnerAmenities.errors.readOnly'
    case ERROR_CODES.NOT_FOUND:
      return 'restaurants:partnerAmenities.errors.notFound'
    case ERROR_CODES.VALIDATION:
      return 'restaurants:partnerAmenities.errors.validation'
    default:
      return 'common:errors.genericError'
  }
}

/**
 * True when the amenity no longer exists in the active catalogue.
 *
 * A real race: an admin can retire an amenity while the partner has the tab
 * open. Rolling the toggle back would be wrong — the row should disappear — so
 * this is the signal to refetch rather than merely revert.
 */
export function isAmenityRetired(error: unknown): boolean {
  return error instanceof HttpError && error.code === ERROR_CODES.NOT_FOUND
}

/** True when the write was refused because the profile is under review (BR-07). */
export function isAmenitiesReadOnly(error: unknown): boolean {
  return error instanceof HttpError && error.code === PROFILE_ERROR_CODES.READ_ONLY
}
