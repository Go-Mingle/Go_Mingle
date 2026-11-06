import type { PartnerRoute } from './types'

export const PROFILE_SETUP_PATH = '/overview'
/**
 * A partner awaiting a decision keeps the portal too. F1 BR-12 asked for a
 * standalone "under review" holding screen, but J6A is both later and more
 * specific: BR-03 describes the profile in Pending as read-only *with an under-
 * review banner*, and BR-17 gives Pending its own 8-tab bar — neither of which
 * means anything if the partner cannot open the page. J6F BR-07 and J6G BR-11
 * likewise call their tabs "viewable whenever the portal is reachable" and
 * read-only in Pending. So Pending renders the real profile, gated read-only,
 * with `PendingBanner` carrying the status.
 */
export const UNDER_REVIEW_PATH = '/overview'
export const FULL_PORTAL_PATH = '/overview'
/**
 * A declined partner lands on the restaurant profile, not a terminal screen —
 * that page *is* BR-12's "rejection view with the reason". It renders the full
 * decline history (J6A BR-13), keeps every card editable (J6A BR-03), and
 * exposes Send for Approval so the application can go back for review
 * (J6A AC-07.6). A dead end here would strand the partner permanently.
 */
export const REJECTED_PATH = '/overview'
export const LOGIN_PATH = '/login'

/**
 * Routes that may reach the portal shell — every state the backend can route to.
 *
 * No lifecycle state is held outside the portal any more: what a partner may
 * *do* is governed by `editable` and by `FullPortalOnly`, not by locking them
 * out of the shell. The list stays explicit rather than becoming a blanket
 * allow, so a route the backend adds later still fails closed at `routeToPath`'s
 * default arm and lands on login rather than rendering a portal we have not
 * reasoned about.
 *
 * It lives beside the path map rather than in `router.tsx` so the guard's
 * allow-list and its tests read one constant. They previously each declared
 * their own copy, which is how a declined partner ended up locked out with the
 * test asserting the lockout was intended.
 */
export const PORTAL_ROUTES = ['FULL_PORTAL', 'PROFILE_SETUP', 'REJECTED', 'UNDER_REVIEW'] as const

/**
 * The single `route → path` map. Every gate and redirect reads it, so the
 * mapping exists exactly once.
 *
 * Every known route resolves to `/overview`: the restaurant profile page is the
 * nine-tab surface and already renders the right affordances per status — setup
 * mode for DRAFT and REJECTED, read-only with a banner for PENDING. Only an
 * unrecognised route resolves anywhere else.
 */
export function routeToPath(route: PartnerRoute): string {
  switch (route) {
    case 'PROFILE_SETUP':
      return PROFILE_SETUP_PATH
    case 'UNDER_REVIEW':
      return UNDER_REVIEW_PATH
    case 'FULL_PORTAL':
      return FULL_PORTAL_PATH
    case 'REJECTED':
      return REJECTED_PATH
    default:
      // An unknown route means the backend added one we do not handle yet;
      // sending the partner to login is the safe fallback.
      return LOGIN_PATH
  }
}
