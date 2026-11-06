/**
 * J6C Restaurant Profile — Amenities (Partner Portal).
 *
 * Two client-callable endpoints. No restaurant id appears on either route: it is
 * resolved from the access token (F1 BR-04), and J6C accepts none from the
 * client — same as J6A and J6B.
 */
const ROOT = '/api/v1/partner/restaurant/amenities'

export const PARTNER_AMENITIES_ENDPOINTS = {
  /** The active catalogue, each item flagged with this restaurant's selection. */
  list: ROOT,
  /** Sets one amenity's assignment state. Idempotent in both directions. */
  byId: (amenityId: string) => `${ROOT}/${amenityId}`,
} as const

export const PARTNER_AMENITIES_QUERY_KEY = ['partner', 'restaurant', 'amenities'] as const

/**
 * J6C introduces **no new error codes** (spec §4.3). It reuses F1's
 * `ERR_NOT_FOUND` / `ERR_VALIDATION` and J6A's `ERR_PROFILE_READ_ONLY`, so the
 * catalogues those live in are the ones to read.
 */
