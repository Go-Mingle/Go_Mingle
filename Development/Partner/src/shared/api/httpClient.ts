import { captureException } from '../observability/sentry'
import { ENV } from '../../configs/env'
import { refreshOnce } from '../auth/refreshCoordinator'
import { emitSessionLost, type SessionLostReason } from '../auth/sessionEvents'
import { tokenStore } from '../auth/tokenStore'
import { ERROR_CODES } from './constants'
import { messageFromErrorBody } from './errorEnvelope'
import { scrubTokens } from './scrubTokens'

/**
 * Resolves an endpoint path against the API origin.
 *
 * Endpoints are declared as absolute paths (`/api/v1/partner/...`). The dev
 * server proxies `/api` to `VITE_API_BASE_URL` (see vite.config.ts), so locally
 * they stay same-origin and no CORS is involved — which is why a bare `fetch`
 * worked in development for so long.
 *
 * A deployed build has no proxy. The bundle is static on CloudFront/S3, so a
 * relative `/api/...` resolves to the CDN, misses, and the SPA fallback returns
 * `index.html` with **200 OK** — the client then fails parsing HTML as JSON and
 * reports a generic error, with nothing in the network tab that looks wrong.
 * A deployed build therefore has to address the API host directly.
 *
 * Exported for its own tests; a trailing slash on the base is tolerated because
 * it comes from a hand-entered CI variable.
 */
export function resolveApiUrl(path: string, base: string): string {
  const origin = base.trim().replace(/\/+$/, '')
  return origin ? `${origin}${path}` : path
}

/** Empty in dev so the proxy handles it; the API origin in a deployed build. */
function apiOrigin(): string {
  return import.meta.env.DEV ? '' : ENV.API_BASE_URL
}

// ── Auth token resolver ────────────────────────────────────────
// The Cognito access token, written by the partner auth layer
// (src/shared/auth/tokenStore.ts). Undefined when unauthenticated, so the app
// still works during development against the mock service worker.
function getAuthToken(): string | undefined {
  return tokenStore.getAccessToken() ?? undefined
}

// ── Error class ────────────────────────────────────────────────
/**
 * Thrown for every non-2xx response. `code` carries the backend's canonical
 * `ERR_*` value (from `{ error: { code, message } }`) so call sites can branch
 * on a specific failure; it is `''` when the body carries no code.
 *
 * `message` is the backend's own sentence whenever it sent one (MET-1256). It
 * used to be the `ERR_*` code, which meant the one thing a call site would
 * naturally reach for showed the partner `ERR_MENU_OPTION_IN_USE` instead of
 * "…can't be deleted. You can hide it instead." The code is still on `code`,
 * where branching belongs.
 */
export class HttpError extends Error {
  readonly status: number
  readonly statusText: string
  readonly code: string
  responseBody?: unknown

  constructor(status: number, statusText: string, message: string, code: string = '') {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.statusText = statusText
    this.code = code
  }
}

/** A downloaded file plus the name the server asked us to save it as. */
export interface FileDownload {
  blob: Blob
  filename: string
}

/**
 * How a successful response body is turned into a value. Everything JSON goes
 * through {@link parseJsonEnvelope}; the CSV export needs the raw bytes, and
 * routing it through the same request path is what keeps the Bearer header,
 * the session policy and the Sentry reporting identical for both.
 */
type ResponseParser<T> = (response: Response) => Promise<T>

/** `attachment; filename="finances-2026-05-04-1307.csv"` → the filename. */
function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback
  const quoted = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header)
  return quoted?.[1]?.trim() || fallback
}

async function parseBlobDownload(response: Response): Promise<FileDownload> {
  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(response.headers.get('Content-Disposition'), 'download'),
  }
}

// ── Internal request helper ────────────────────────────────────
async function request<T>(
  method: string,
  url: string,
  body?: unknown,
  parse: ResponseParser<T> = parseJsonEnvelope,
): Promise<T> {
  const token = getAuthToken()

  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  let response: Response

  try {
    response = await fetch(resolveApiUrl(url, apiOrigin()), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (networkError) {
    // Network failure (offline, DNS, CORS, etc.)
    captureException(networkError, {
      tags: { component: 'httpClient', url, method },
    })
    throw networkError
  }

  if (!response.ok) {
    // Read the body exactly once — it cannot be consumed twice, so parse the
    // text rather than trying response.json() and falling back to .text().
    const errorBody = await response.text().catch(() => '')
    let parsedJson: unknown = null
    let errorCode = ''
    try {
      parsedJson = JSON.parse(errorBody)
      errorCode = (parsedJson as { error?: { code?: string } })?.error?.code ?? ''
    } catch {
      // Non-JSON body (HTML error page, empty response, …) — leave it as text.
    }

    // The backend's own sentence first: it is specific enough to tell the
    // partner what to do next, and two of the catalogue entries literally name
    // the remedy. Falling back to the code keeps the previous behaviour for
    // bodies that carry no message at all.
    const error = new HttpError(
      response.status,
      response.statusText,
      messageFromErrorBody(parsedJson) || errorCode || errorBody || response.statusText,
      errorCode,
    )
    error.responseBody = parsedJson
    captureException(error, {
      tags: {
        component: 'httpClient',
        url,
        method,
        status: String(response.status),
        // The message used to be the code, so Sentry grouped by it for free.
        // Now that it is server prose — which can interpolate names, counts and
        // filenames — grouping is pinned explicitly instead of fragmenting one
        // failure mode into an issue per wording.
        errorCode: errorCode || 'none',
      },
      fingerprint: ['httpClient', String(response.status), errorCode || 'no-code'],
      // Scrubbed: an auth endpoint's error body can carry a session (BR-11).
      extra: { responseBody: scrubTokens(errorBody) },
    })
    throw error
  }

  return parse(response)
}

async function parseJsonEnvelope<T>(response: Response): Promise<T> {
  // 204 No Content — return undefined cast to T
  if (response.status === 204) {
    return undefined as T
  }

  const json: unknown = await response.json()
  // Unwrap the `{ success: true, data: T }` envelope used by every /api/v1/*
  // endpoint. Both keys must be present, so the legacy `{ success: true }`
  // ack responses and bespoke wrappers pass through untouched.
  if (json !== null && typeof json === 'object' && 'success' in json && 'data' in json) {
    return (json as { data: T }).data
  }
  return json as T
}

// ── Session policy ─────────────────────────────────────────────
/**
 * Applies the F1 session contract on top of a bare request.
 *
 *   401 ERR_TOKEN_EXPIRED  → refresh once via Cognito, retry the call once
 *   401 anything else      → session is unrecoverable; clear and route to login
 *   403 ERR_ACCOUNT_SUSPENDED → clear and route to login. Never refresh, never
 *                            retry — a refresh cannot lift a suspension, and
 *                            retrying loops forever against a still-valid token
 *   404 / 503 / other      → surfaced to the caller untouched; the session stands
 *
 * `attempt` is a call-stack parameter rather than module state, so the
 * exactly-once guarantee holds no matter how many requests are in flight.
 */
function endSession(reason: SessionLostReason): void {
  tokenStore.clear()
  // Idempotent: N requests failing together terminate the session once, not N
  // times (AC-02.2).
  emitSessionLost(reason)
}

/**
 * Ends the session and abandons the caller.
 *
 * BR-07: "Any queued request is discarded rather than surfaced as an error, so
 * the user sees one clean transition, not a cascade of failures." Rejecting
 * would hand the error to the call site, and all 36 of them toast it — so N
 * concurrent expiries would produce N error toasts on top of the redirect.
 *
 * The promise is deliberately never settled. `SessionWatcher` clears the query
 * cache and routes to /login, which drops every reference to it.
 */
function discardRequest<T>(reason: SessionLostReason): Promise<T> {
  endSession(reason)
  return new Promise<T>(() => {})
}

/** True when this 401 is a plain expiry we have not already tried to recover. */
function isRecoverableExpiry(error: HttpError, attempt: number): boolean {
  return error.status === 401 && error.code === ERROR_CODES.TOKEN_EXPIRED && attempt === 0
}

async function requestWithSessionPolicy<T>(
  method: string,
  url: string,
  body: unknown,
  attempt: number,
  parse: ResponseParser<T> = parseJsonEnvelope,
): Promise<T> {
  // Captured before the call so the refresh can tell "my token was rejected"
  // from "another tab already replaced it" (BR-09).
  const sentToken = getAuthToken() ?? null

  try {
    return await request<T>(method, url, body, parse)
  } catch (error) {
    if (!(error instanceof HttpError)) throw error

    // BR-08 — a request made without a session gets no session handling at all.
    // There is no refresh token to exchange and nothing to terminate, and
    // "your session has expired" would be a lie to someone who never had one.
    // The caller handles the failure and the route guard sends them to login.
    if (!sentToken) throw error

    if (isRecoverableExpiry(error, attempt)) {
      try {
        await refreshOnce(sentToken)
      } catch {
        return discardRequest<T>('REFRESH_FAILED')
      }
      // The retry re-reads the token, so it carries the newly minted one.
      return requestWithSessionPolicy<T>(method, url, body, 1, parse)
    }

    // 403 never refreshes and never retries — see the doc comment.
    if (error.status === 403 && error.code === ERROR_CODES.ACCOUNT_SUSPENDED) {
      return discardRequest<T>('ACCOUNT_SUSPENDED')
    }
    if (error.status === 401) {
      // Covers ERR_TOKEN_INVALID (BR-06c) and a replayed request that 401s a
      // second time (BR-06b) — `attempt` is 1 there, so it is not recoverable.
      return discardRequest<T>('TOKEN_INVALID')
    }

    // Everything else — 403 other, 4xx, 5xx, network — is ordinary error
    // handling. The session stands and the caller sees the failure.
    throw error
  }
}

function send<T>(method: string, url: string, body?: unknown): Promise<T> {
  return requestWithSessionPolicy<T>(method, url, body, 0)
}

// ── Public API ─────────────────────────────────────────────────
export const httpClient = {
  get<T>(url: string): Promise<T> {
    return send<T>('GET', url)
  },

  post<T>(url: string, body: unknown): Promise<T> {
    return send<T>('POST', url, body)
  },

  put<T>(url: string, body: unknown): Promise<T> {
    return send<T>('PUT', url, body)
  },

  patch<T>(url: string, body: unknown): Promise<T> {
    return send<T>('PATCH', url, body)
  },

  delete<T = void>(url: string): Promise<T> {
    return send<T>('DELETE', url)
  },

  /**
   * Fetches a file rather than JSON — currently J5's CSV export, which responds
   * `text/csv` with a `Content-Disposition` filename instead of an envelope.
   *
   * It goes through this client rather than a bare `fetch` or an anchor `href`
   * because the endpoint is authenticated: an anchor cannot carry the Bearer
   * header, and a second `fetch` would duplicate the session policy, the 401
   * refresh-and-retry and the Sentry reporting.
   */
  download(url: string): Promise<FileDownload> {
    return requestWithSessionPolicy<FileDownload>('GET', url, undefined, 0, parseBlobDownload)
  },
}

/**
 * For endpoints that run **before a session exists** — currently the J1 signup
 * lead-in (`/partner/signup/start`, `/resend`, `/verify`).
 *
 * Identical to {@link httpClient} for the envelope, error parsing and Sentry
 * reporting, but deliberately skips the session policy. A 401 from any of them
 * cannot mean a session ended, because none has been issued yet: there is
 * nothing to clear and no refresh token to exchange, so routing it through the
 * policy would toast "your session has expired" at someone who never had one.
 *
 * `signup/complete` is **not** on this client. `verify` logs the partner in, so
 * `complete` is an ordinary authenticated call on {@link httpClient} and a 401
 * there is a genuine session loss (see PARTNER_PORTAL_J1_SIGNUP.md §4.1).
 */
export const publicHttpClient = {
  get<T>(url: string): Promise<T> {
    return request<T>('GET', url)
  },

  post<T>(url: string, body: unknown): Promise<T> {
    return request<T>('POST', url, body)
  },
}
