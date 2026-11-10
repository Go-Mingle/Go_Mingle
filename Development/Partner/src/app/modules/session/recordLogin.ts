import { sessionService } from './services'

/**
 * Records the login time and returns immediately (J2 BR-16).
 *
 * Fired once per login — after an ordinary sign-in and after signup's password
 * step — and never awaited. The write is best-effort: a failure must not
 * invalidate the session the partner just established, nor delay entry into the
 * portal, so everything is swallowed here.
 *
 * The 401 and 403 cases still get their standard treatment, because the call goes
 * through the ordinary `httpClient` and its session policy runs before this
 * catch: a 401 clears the session and routes to login, a 403 does the same with
 * the suspended message. Only the remaining failures — a 500, an outage — are
 * genuinely ignored.
 *
 * Deliberately NOT called on every `GET /partner/session`. Routing is re-fetched
 * freely; login time is not. Stamping it per session read would turn J3's "Last
 * Active" column into "last page load".
 */
export function recordLoginQuietly(): void {
  void sessionService.recordLogin().catch(() => undefined)
}
