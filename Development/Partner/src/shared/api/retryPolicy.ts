import { MAX_SERVICE_UNAVAILABLE_RETRIES } from './constants'
import { HttpError } from './httpClient'

/**
 * A 503 means the backend could not verify suspension state and failed closed
 * (BR-16). It is transient, so we retry with backoff and — critically — keep
 * the session. Every other status is terminal for the query.
 *
 * This lives per-hook rather than on the QueryClient because App.tsx (which
 * owns the client, with `retry: 1`) is a protected file. Per-hook options win
 * over client defaults in React Query v5.
 */
export function shouldRetryPartnerQuery(failureCount: number, error: unknown): boolean {
  return (
    error instanceof HttpError &&
    error.status === 503 &&
    failureCount < MAX_SERVICE_UNAVAILABLE_RETRIES
  )
}

export function partnerRetryDelay(attemptIndex: number): number {
  return Math.min(500 * 2 ** attemptIndex, 8000)
}

/** Spread into any `useQuery` that talks to `/api/v1/partner/*`. */
export const partnerRetryPolicy = {
  retry: shouldRetryPartnerQuery,
  retryDelay: partnerRetryDelay,
} as const
