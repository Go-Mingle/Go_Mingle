/**
 * J3 Users Management (Partner Portal) — the restaurant account's sub-users.
 *
 * Versioned under `/api/v1/partner/*` like the rest of the partner API. The
 * restaurant scope is never sent: the backend derives it from the access token
 * (F1 BR-04 / CR-52), and passing `restaurantId` is rejected with a 422 rather
 * than silently ignored.
 */
export const PARTNER_USERS_ENDPOINTS = {
  list: '/api/v1/partner/users',
  byId: (id: string) => `/api/v1/partner/users/${id}`,
  setPassword: (id: string) => `/api/v1/partner/users/${id}/set-password`,
} as const

export const PARTNER_USERS_QUERY_KEY = ['partner', 'users'] as const

/** The grid is paginated server-side; 25/page is the spec default (AC-01.2). */
export const USERS_DEFAULT_PAGE_SIZE = 25
export const USERS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

/** F1 entity limits, enforced client-side so a 422 is the exception not the norm. */
export const FULL_NAME_MAX_LENGTH = 100
export const DESIGNATION_MAX_LENGTH = 100

/**
 * BR-08 — the platform password rule at create and at set-password is the same
 * one J1/J2 already enforce, so it is reused rather than restated here; see
 * `meetsPasswordPolicy` in `shared/utils/passwordStrength`.
 */

/** J3-introduced error codes (spec §4.3). Neither is a session failure. */
export const USERS_ERROR_CODES = {
  DUPLICATE_EMAIL: 'ERR_DUPLICATE_EMAIL',
  FORBIDDEN_PRIMARY: 'ERR_FORBIDDEN_PRIMARY',
} as const
