export const INTERESTS_ENDPOINTS = {
  list: '/api/v1/interests',
  active: '/api/v1/interests/active',
  byId: (id: string) => `/api/v1/interests/${id}`,
} as const

/**
 * GET /api/v1/interests accepts `pageSize` ∈ {25, 50, 100} only — anything else
 * (including the 10 offered by the shared PAGE_SIZE_OPTIONS) silently falls back
 * to 25 server-side, which would leave the selector showing one size while the
 * API returned another. This module therefore offers exactly what the endpoint
 * supports instead of the shared list.
 */
export const INTERESTS_PAGE_SIZE_OPTIONS = [25, 50, 100] as const

export const INTERESTS_PAGE_SIZE = 25
