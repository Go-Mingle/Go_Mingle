import { message } from 'antd'
import i18n from '../../locales/i18n'
import { store } from '../store/store'
import { expireSessionAction } from '../store/authSlice'
import { refreshAccessToken } from '../../app/modules/auth/cognitoService'

/**
 * FE1 — Frontend Session & Auth Request Contract.
 *
 * The single owner of token renewal (BR-02, BR-04) and session termination
 * (BR-06, BR-07) for the Admin SPA. `httpClient` is the only caller; keeping
 * this in one module is what makes single-flight renewal hold process-wide
 * (BR-10) — a per-call or per-module implementation could not.
 */

export type SessionEndReason = 'SUSPENDED' | 'EXPIRED' | 'INVALID'

/**
 * Survives the hard redirect to /login so the reason can be shown there
 * (AC-04.4) — a toast alone is destroyed the moment the page navigates.
 */
export const SESSION_NOTICE_KEY = 'auth-session-notice'

const SESSION_CHANNEL = 'gomingle-session'

const NOTICE_I18N_KEY: Record<SessionEndReason, string> = {
  SUSPENDED: 'session.suspended',
  EXPIRED: 'session.expired',
  INVALID: 'session.invalid',
}

export function getAuthToken(): string | undefined {
  return localStorage.getItem('auth-token') ?? undefined
}

// ── Cross-tab channel (BR-09) ──────────────────────────────────
// jsdom does not implement BroadcastChannel, and neither do older browsers,
// so every use is feature-detected. Losing the channel degrades to per-tab
// behaviour rather than breaking the session logic.
let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  channel ??= new BroadcastChannel(SESSION_CHANNEL)
  return channel
}

// ── Termination (BR-06, BR-07) ─────────────────────────────────
function clearAndRedirect(): void {
  store.dispatch(expireSessionAction())
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

/**
 * Ends the session: clears local tokens and state, drops anything queued, and
 * routes to login. Deliberately does **not** call Cognito `GlobalSignOut`
 * (BR-07, AC-03.5) — the refresh token is already invalid, so the call is
 * redundant and can itself fail. User-initiated sign-out is a separate journey
 * and still revokes.
 *
 * Idempotent by way of the token check: the first call clears the stored token,
 * so N requests failing together produce one termination and one message, not
 * N (AC-02.2). The same check makes this a no-op for an unauthenticated caller,
 * which is what BR-08 requires.
 */
export function terminateSession(reason: SessionEndReason): void {
  if (!getAuthToken()) return

  const text = i18n.t(NOTICE_I18N_KEY[reason])
  void message.error(text)
  sessionStorage.setItem(SESSION_NOTICE_KEY, reason)

  getChannel()?.postMessage({ type: 'TERMINATED', reason })
  clearAndRedirect()
}

/**
 * A sibling tab terminated (BR-09). Clear this tab too, but do not re-broadcast
 * or re-notify — the user gets one clean transition, not a cascade.
 */
function handleChannelMessage(event: MessageEvent): void {
  const data = event.data as { type?: string; reason?: SessionEndReason } | null
  if (data?.type !== 'TERMINATED') return
  if (data.reason) sessionStorage.setItem(SESSION_NOTICE_KEY, data.reason)
  clearAndRedirect()
}

export function initSessionChannel(): void {
  const ch = getChannel()
  if (!ch) return
  ch.onmessage = handleChannelMessage
}

// ── Renewal (BR-02, BR-04, BR-09) ──────────────────────────────
let pendingRenewal: Promise<string> | null = null

/**
 * Exchanges the refresh token for a new access token, client↔Cognito. There is
 * no backend refresh endpoint on any surface (BR-02), so this goes straight to
 * the Cognito SDK against this surface's own pool.
 *
 * Single-flight (BR-04): a renewal already in progress is joined rather than
 * duplicated — the shared promise *is* the queue of waiting requests. Parallel
 * exchanges are the most damaging failure available here: under refresh-token
 * rotation a second exchange can invalidate the token the first just used.
 *
 * @param failedToken the access token that was rejected. If storage no longer
 * holds it, another tab (or an earlier request here) has already renewed, so
 * the new token is returned without a second exchange — BR-09's shared-renewal
 * half, without needing Web Locks.
 */
export function renewSession(failedToken: string): Promise<string> {
  const current = getAuthToken()
  if (current && current !== failedToken) return Promise.resolve(current)

  pendingRenewal ??= refreshAccessToken().finally(() => {
    pendingRenewal = null
  })

  return pendingRenewal
}

// ── Login-screen notice ────────────────────────────────────────
/** One-shot read: the notice is consumed so a later reload shows nothing. */
export function readAndClearSessionNotice(): SessionEndReason | null {
  const stored = sessionStorage.getItem(SESSION_NOTICE_KEY)
  if (!stored) return null
  sessionStorage.removeItem(SESSION_NOTICE_KEY)
  return stored as SessionEndReason
}

/** Test seam — resets the module-level renewal guard and cached channel. */
export function resetSessionStateForTests(): void {
  pendingRenewal = null
  channel = null
}
