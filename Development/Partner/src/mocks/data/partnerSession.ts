import { HttpResponse } from 'msw'
import type {
  PartnerRoute,
  PartnerSession,
  RestaurantStatus,
} from '../../app/modules/session/types'

/**
 * Mutable demo state. The ReviewStatusScreen approve/reject simulator and the
 * sign-up flow flip `route` here so the prototype keeps working end to end.
 *
 * The default is FULL_PORTAL deliberately: any other default would redirect
 * every already-green authenticated screen test away from its own page.
 */
export const partnerSessionState = {
  route: 'FULL_PORTAL' as PartnerRoute,
  isPrimary: true,
  payoutReady: false,
}

export function resetPartnerSessionState(): void {
  partnerSessionState.route = 'FULL_PORTAL'
  partnerSessionState.isPrimary = true
  partnerSessionState.payoutReady = false
}

/**
 * The prototype writes a lowercase `profileStatus` onto the restaurant; the
 * real backend derives `route` from `restaurants.status`. Bridge the two so the
 * demo approve/reject simulator still moves the partner between screens.
 */
const ROUTE_BY_PROFILE_STATUS: Record<string, PartnerRoute> = {
  draft: 'PROFILE_SETUP',
  pending: 'UNDER_REVIEW',
  active: 'FULL_PORTAL',
  rejected: 'REJECTED',
}

export function applyDemoProfileStatus(profileStatus: string): void {
  const route = ROUTE_BY_PROFILE_STATUS[profileStatus.toLowerCase()]
  if (route) partnerSessionState.route = route
}

const STATUS_BY_ROUTE: Record<PartnerRoute, RestaurantStatus> = {
  PROFILE_SETUP: 'DRAFT',
  UNDER_REVIEW: 'PENDING',
  FULL_PORTAL: 'ACTIVE',
  REJECTED: 'REJECTED',
}

/**
 * `rest1` is the id the legacy prototype already uses, so the existing
 * `/api/restaurants/rest1` handler keeps serving the profile page unchanged.
 */
export function buildPartnerSession(overrides: Partial<PartnerSession> = {}): PartnerSession {
  const route = overrides.route ?? partnerSessionState.route
  return {
    partnerUser: {
      id: 'pu1',
      fullName: 'Hira Mansoor',
      email: 'partner@gomingle.com',
      designation: 'Owner',
      isPrimary: partnerSessionState.isPrimary,
      ...overrides.partnerUser,
    },
    restaurant: {
      id: 'rest1',
      name: 'Aurelia',
      status: STATUS_BY_ROUTE[route],
      payoutReady: partnerSessionState.payoutReady,
      // Null for every partner today — nothing writes partner media yet.
      coverImageUrl: null,
      ...overrides.restaurant,
    },
    route,
  }
}

function errorEnvelope(code: string, message: string, status: number) {
  return HttpResponse.json({ success: false, error: { code, message } }, { status })
}

/** Ready-made responses so a test selects a scenario in one line. */
export const sessionResponses = {
  /** J2 BR-16 — the login-recorded stamp. */
  loginRecorded: (lastActiveAt = '2026-08-03T09:12:04.000Z') =>
    HttpResponse.json({ success: true, data: { lastActiveAt } }),

  ok: (overrides: Partial<PartnerSession> = {}) =>
    HttpResponse.json({ success: true, data: buildPartnerSession(overrides) }),
  tokenExpired: () => errorEnvelope('ERR_TOKEN_EXPIRED', 'Session expired.', 401),
  tokenInvalid: () => errorEnvelope('ERR_TOKEN_INVALID', 'Authentication required.', 401),
  suspended: () =>
    errorEnvelope(
      'ERR_ACCOUNT_SUSPENDED',
      'Your account has been suspended. Please contact support.',
      403,
    ),
  notFound: () => errorEnvelope('ERR_NOT_FOUND', 'Account not found.', 404),
  unavailable: () => errorEnvelope('ERR_SERVICE_UNAVAILABLE', 'Something went wrong.', 503),
  internal: () => errorEnvelope('ERR_INTERNAL', 'Something went wrong.', 500),
}
