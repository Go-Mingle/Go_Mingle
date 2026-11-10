/**
 * Why the session ended. `ACCOUNT_SUSPENDED` covers both BR-03 (this user was
 * suspended) and BR-16 (the whole restaurant was) — the backend returns the
 * same 403 for both, by design, and the client must not try to tell them apart.
 */
export type SessionLostReason =
  | 'TOKEN_INVALID'
  | 'ACCOUNT_SUSPENDED'
  | 'REFRESH_FAILED'
  | 'NO_PARTNER_ACCOUNT'

type Listener = (reason: SessionLostReason) => void

// A Set, not an array, so React 19 StrictMode's double-invoked effects cannot
// register the same listener twice.
const listeners = new Set<Listener>()

/** Subscribe; returns the unsubscribe function for use as an effect cleanup. */
export function onSessionLost(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * A session can only be lost once (FE1 AC-02.2). N requests failing together
 * would otherwise each emit, producing N toasts and N redirects for what the
 * user experienced as one event. Reset when a new session is stored.
 */
let lost = false

/**
 * Emitted from the HTTP layer, which has no React context. A listener mounted
 * above the router turns this into a toast plus a redirect.
 *
 * Idempotent: only the first call for a given session reaches the listeners.
 */
export function emitSessionLost(reason: SessionLostReason): void {
  if (lost) return
  lost = true
  listeners.forEach((listener) => {
    listener(reason)
  })
}

/**
 * Re-arms the latch. Called by `tokenStore.setTokens` — every new session goes
 * through it, so no individual journey has to remember to reset this.
 */
export function resetSessionLostLatch(): void {
  lost = false
}

/** True once this session has ended; the queue drains rather than erroring. */
export function isSessionLost(): boolean {
  return lost
}

/** Test-only — the module singleton outlives a test file otherwise. */
export function __clearSessionListeners(): void {
  listeners.clear()
  lost = false
}
