import { useQuery } from '@tanstack/react-query'
import { partnerRetryPolicy } from '../../../../shared/api/retryPolicy'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { PARTNER_SESSION_QUERY_KEY, SESSION_STALE_TIME_MS } from '../constants'
import { sessionService } from '../services'

/**
 * Loads the partner principal and the route the client should render.
 *
 * The retry policy is set here rather than on the QueryClient because App.tsx
 * is a protected file — see `shared/api/retryPolicy.ts`. A 503 backs off and
 * keeps the session; every other failure is terminal for the query, and the
 * HTTP layer has already dealt with any session consequences.
 */
export function usePartnerSession() {
  return useQuery({
    queryKey: PARTNER_SESSION_QUERY_KEY,
    queryFn: sessionService.get,
    staleTime: SESSION_STALE_TIME_MS,
    // No token means no authenticated call to make; AuthGuard sends the user to login.
    enabled: tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}
