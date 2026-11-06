import { getSessionRestaurantId } from '../session/restaurantIdCache'

export { useProfileRestaurant } from './hooks/useProfileRestaurant'

/** Seeded, already-approved demo restaurant (regular login). */
export const PARTNER_RESTAURANT_ID = 'rest1'
/** Empty restaurant a brand-new partner fills out during sign-up. */
export const DRAFT_RESTAURANT_ID = 'restDraft'

const PARTNER_RID_KEY = 'gomingle_partner_rid'

/**
 * The restaurant the signed-in partner manages.
 *
 * The live session is authoritative (BR-04) — `SessionBoundary` publishes the
 * id as soon as `/partner/session` resolves. The localStorage fallback only
 * covers the pre-session prototype paths (sign-up, invite) and callers that run
 * before the boundary has mounted. React components should prefer
 * `useRestaurantId()` from the session context.
 */
export function getPartnerRestaurantId(): string {
  const fromSession = getSessionRestaurantId()
  if (fromSession) return fromSession
  try {
    return localStorage.getItem(PARTNER_RID_KEY) || PARTNER_RESTAURANT_ID
  } catch {
    return PARTNER_RESTAURANT_ID
  }
}

export function setPartnerRestaurantId(id: string) {
  try {
    localStorage.setItem(PARTNER_RID_KEY, id)
  } catch {
    /* ignore */
  }
}

/**
 * Presentation only. Routing is driven by the server-derived `route` on
 * `GET /api/v1/partner/session` (see `modules/session/SessionGate.tsx`) — this
 * lowercase status is what the profile page uses to decide whether to render
 * its setup banner, and nothing routes on it.
 */
export type ProfileStatus = 'draft' | 'pending' | 'active' | 'rejected'

export function profileStatusOf(data: Record<string, unknown> | undefined): ProfileStatus {
  return (data?.profileStatus as ProfileStatus | undefined) ?? 'active'
}
