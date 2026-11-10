import type { SessionLostReason } from './sessionEvents'

/**
 * Cross-tab session coordination (FE1 BR-09).
 *
 * Two things must be shared across a browser rather than held per tab:
 *
 * 1. **The renewal.** BR-04's single-flight rule is about the *browser*, not the
 *    tab. Two tabs expiring together and each exchanging their refresh token is
 *    the failure the spec calls the most damaging one available: under Cognito
 *    refresh-token rotation the second exchange can invalidate the first, so a
 *    recoverable expiry becomes a forced sign-out everywhere.
 * 2. **The termination.** A session that ended in one tab has ended in all of
 *    them; leaving the others on a dead session shows the user a broken app.
 *
 * Both APIs are feature-detected. Where they are missing — older browsers, and
 * jsdom, which implements neither — this degrades to the per-tab behaviour that
 * came before, which is correct for a single tab and no worse than it was.
 *
 * Messages carry a **reason and never a token** (BR-11). Tabs re-read the token
 * from the shared `localStorage`, so nothing sensitive crosses the channel.
 */

const REFRESH_LOCK_NAME = 'gomingle-partner-refresh'
const CHANNEL_NAME = 'gomingle-partner-session'

interface SessionLostMessage {
  type: 'session-lost'
  reason: SessionLostReason
}

/** The subset of the Web Locks API we use, so this compiles without lib.dom's. */
interface LockManagerLike {
  request: <T>(name: string, callback: () => Promise<T>) => Promise<T>
}

function getLockManager(): LockManagerLike | null {
  const locks = (navigator as Navigator & { locks?: LockManagerLike }).locks
  return typeof locks?.request === 'function' ? locks : null
}

/**
 * Runs `fn` under a browser-wide mutex so only one tab renews at a time.
 *
 * Callers must still re-check the stored token *inside* `fn`: the lock
 * serialises the tabs, but the tab that waited would otherwise go on to make a
 * second, now-unnecessary exchange (see `refreshCoordinator`).
 */
export async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = getLockManager()
  if (!locks) return fn()
  return locks.request(REFRESH_LOCK_NAME, fn)
}

function createChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  try {
    return new BroadcastChannel(CHANNEL_NAME)
  } catch {
    // Some privacy modes expose the constructor but refuse to construct it.
    return null
  }
}

let channel: BroadcastChannel | null | undefined

/** Lazy so a tab that never authenticates never opens a channel. */
function getChannel(): BroadcastChannel | null {
  channel ??= createChannel()
  return channel
}

/** Tells the other tabs the session ended, and why. Never sends a token. */
export function broadcastSessionLost(reason: SessionLostReason): void {
  const message: SessionLostMessage = { type: 'session-lost', reason }
  try {
    getChannel()?.postMessage(message)
  } catch {
    // A closed or unavailable channel must never break the local teardown,
    // which is the part the user actually sees.
  }
}

function isSessionLostMessage(data: unknown): data is SessionLostMessage {
  return (data as SessionLostMessage | null)?.type === 'session-lost'
}

/**
 * Subscribes to terminations raised by *other* tabs. Returns the unsubscribe
 * function, for use as an effect cleanup.
 */
export function onRemoteSessionLost(listener: (reason: SessionLostReason) => void): () => void {
  const active = getChannel()
  if (!active) return () => {}

  const handler = (event: MessageEvent<unknown>) => {
    if (isSessionLostMessage(event.data)) listener(event.data.reason)
  }
  active.addEventListener('message', handler)
  return () => {
    active.removeEventListener('message', handler)
  }
}

/** Test-only — the channel is module state that outlives a test file. */
export function __resetCrossTabSession(): void {
  try {
    channel?.close()
  } catch {
    /* already closed */
  }
  channel = undefined
}
