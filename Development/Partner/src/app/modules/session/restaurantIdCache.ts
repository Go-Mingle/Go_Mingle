/**
 * The restaurant id from the live session, mirrored into a module singleton.
 *
 * The legacy prototype resolved the id from `localStorage`, and a handful of
 * non-React call sites still read it synchronously. Rather than rewrite them
 * all in this change, `SessionBoundary` publishes the authoritative id here and
 * `getPartnerRestaurantId()` prefers it. React components should use
 * `useRestaurantId()` from SessionContext instead.
 */
let cachedRestaurantId: string | null = null

export function setSessionRestaurantId(id: string | null): void {
  cachedRestaurantId = id
}

export function getSessionRestaurantId(): string | null {
  return cachedRestaurantId
}
