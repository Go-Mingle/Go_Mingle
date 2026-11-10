/**
 * Partner Portal endpoints are versioned (`/api/v1/partner/*`). The legacy
 * prototype endpoints under `/api/*` stay unversioned until their own journey
 * spec lands.
 */
export const SESSION_ENDPOINTS = {
  session: '/api/v1/partner/session',
  /**
   * J2 BR-16 — stamps `last_active_at` on the caller's own row. Deliberately
   * separate from the session read: routing may be re-fetched many times, but
   * login time must be recorded exactly once per login, or "Last Active" on the
   * Users page degrades into "last page load".
   */
  loginRecorded: '/api/v1/partner/session/login-recorded',
} as const

export const PARTNER_SESSION_QUERY_KEY = ['partner', 'session'] as const

/** Refetch the session at most every five minutes; routing rarely changes. */
export const SESSION_STALE_TIME_MS = 5 * 60 * 1000
