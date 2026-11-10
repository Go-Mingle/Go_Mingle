import { getAuthProvider } from './authProvider'
import { withRefreshLock } from './crossTabSession'
import { tokenStore } from './tokenStore'

let inFlight: Promise<string> | null = null

/**
 * Single-flight token refresh (FE1 BR-04), coordinated across tabs (BR-09).
 *
 * N requests failing with `ERR_TOKEN_EXPIRED` at the same moment must trigger
 * one Cognito exchange, not N — otherwise the pool sees a burst of refreshes
 * and, under refresh-token rotation, all but the first may be rejected as
 * replays, turning a recoverable expiry into a forced sign-out.
 *
 * Two layers give that guarantee:
 *
 * - `inFlight` collapses concurrent callers **within** this tab.
 * - `withRefreshLock` serialises tabs **across** the browser.
 *
 * The lock alone is not enough. It makes the second tab wait rather than skip,
 * so once it acquires the lock it would go on to exchange a refresh token the
 * first tab has already rotated away. Hence `staleToken`: the caller passes the
 * token that was rejected, and if the store now holds a different one, another
 * tab already renewed and we adopt its result without calling Cognito at all.
 */
export function refreshOnce(staleToken?: string | null): Promise<string> {
  inFlight ??= withRefreshLock(async () => {
    const current = tokenStore.getAccessToken()
    if (current && staleToken && current !== staleToken) return current
    return getAuthProvider().refresh()
  }).finally(() => {
    inFlight = null
  })
  return inFlight
}

/** Test-only — the in-flight promise is module state that outlives a test. */
export function __resetRefreshCoordinator(): void {
  inFlight = null
}
