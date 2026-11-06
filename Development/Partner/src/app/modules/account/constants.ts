/** J2 owns exactly one resource — the signed-in partner's own profile. */
export const ACCOUNT_ENDPOINTS = {
  me: '/api/v1/partner/me',
} as const

/**
 * Named for the resource, not the concept: `PARTNER_PROFILE_QUERY_KEY` is also
 * the name of J6A's restaurant-profile key (`['partner','restaurant']`), and two
 * different keys under one identifier is a trap waiting to be imported wrongly.
 */
export const PARTNER_ME_QUERY_KEY = ['partner', 'me'] as const

/** F1 entity limits, enforced client-side so the 422 is the exception not the norm. */
export const FULL_NAME_MAX_LENGTH = 100
export const DESIGNATION_MAX_LENGTH = 100
