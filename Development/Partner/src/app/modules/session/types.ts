/**
 * Where the client sends a freshly-authenticated partner (BR-12).
 *
 * Derived server-side from `restaurants.status` so the mapping cannot drift
 * between us and the backend. There is deliberately no SUSPENDED route — a
 * suspended restaurant's users are denied at the guard, so no session ever
 * reaches a routing decision in that state (BR-16).
 */
export type PartnerRoute = 'PROFILE_SETUP' | 'UNDER_REVIEW' | 'FULL_PORTAL' | 'REJECTED'

export type RestaurantStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED'

export interface SessionPartnerUser {
  id: string
  fullName: string
  email: string
  designation: string | null
  /** Gates primary-only surfaces client-side; the backend re-checks (BR-08). */
  isPrimary: boolean
}

export interface SessionRestaurant {
  id: string
  name: string
  status: RestaurantStatus
  /** `payout_account_id IS NOT NULL` (BR-11). The account id is never returned. */
  payoutReady: boolean
  /**
   * A ready-to-use CloudFront URL, never an S3 key (BR-14). Null for every
   * partner today because nothing writes partner media yet — treat null plus a
   * placeholder as the normal case, not an edge case.
   */
  coverImageUrl: string | null
}

export interface PartnerSession {
  partnerUser: SessionPartnerUser
  restaurant: SessionRestaurant
  route: PartnerRoute
}

/** J2 BR-16 — the timestamp the login-recorded call stamped. */
export interface LoginRecordedResponse {
  lastActiveAt: string
}
