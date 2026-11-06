import * as Sentry from '@sentry/react'
import { isMocksEnabled } from './mocksEnabled'
import { getAuthToken, renewSession, terminateSession } from './sessionManager'

// ── URL resolver ───────────────────────────────────────────────
// When mocks are active, MSW intercepts relative URLs, so we keep them
// relative. When mocks are disabled (VITE_MSW_ENABLED=false) we prefix the
// configured API base URL so requests hit the real API host directly,
// whether running locally against a dev backend or in production.
function resolveUrl(url: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL
  if (!isMocksEnabled() && baseUrl) {
    return `${baseUrl.replace(/\/$/, '')}${url}`
  }
  return url
}

// ── Token redaction (FE1 BR-11) ────────────────────────────────
// Neither access nor refresh tokens may appear in logs, analytics or error
// reports. Error bodies are attached to Sentry events, and some auth responses
// echo credentials back, so any token-shaped value is masked before the event
// leaves the client.
const TOKEN_FIELD = /"(access_?token|refresh_?token|id_?token|token|authorization)"\s*:\s*"[^"]*"/gi

export function redactTokens(body: string | undefined): string | undefined {
  return body?.replace(TOKEN_FIELD, (_match, field: string) => `"${field}":"[REDACTED]"`)
}

// ── Error class ────────────────────────────────────────────────
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

// ── Internal request helper ────────────────────────────────────
async function request<T>(
  method: string,
  url: string,
  body?: unknown,
  responseType: 'json' | 'blob' = 'json',
): Promise<T> {
  const token = getAuthToken()

  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const isFormData = body instanceof FormData
  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  let response: Response

  try {
    response = await fetch(resolveUrl(url), {
      method,
      headers,
      body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
    })
  } catch (networkError) {
    // Network failure (offline, DNS, CORS, etc.)
    Sentry.captureException(networkError, {
      tags: { component: 'httpClient', url, method },
    })
    throw networkError
  }

  if (!response.ok) {
    let errorCode = ''
    let errorBody: string | undefined
    let parsedJson: unknown = null
    try {
      const json = await response.json()
      errorCode = (json as { error?: { code?: string } })?.error?.code ?? ''
      errorBody = JSON.stringify(json)
      parsedJson = json
    } catch {
      errorBody = await response.text().catch(() => response.statusText)
    }
    const error = new HttpError(
      response.status,
      response.statusText,
      errorCode || (errorBody ?? ''),
      errorCode,
    )
    error.responseBody = parsedJson
    Sentry.captureException(error, {
      tags: { component: 'httpClient', url, method, status: String(response.status) },
      extra: { responseBody: redactTokens(errorBody) },
    })
    throw error
  }

  // 204 No Content — return undefined cast to T
  if (response.status === 204) {
    return undefined as T
  }

  if (responseType === 'blob') {
    return (await response.blob()) as unknown as T
  }

  const json = await response.json()
  // Unwrap { success: true, data: T } envelope used by all J1+ admin endpoints
  if (json !== null && typeof json === 'object' && 'success' in json && 'data' in json) {
    return (json as { data: T }).data
  }
  return json as T
}

/**
 * FE1 BR-03 — the decision table, evaluated on every API response.
 *
 * Branches on the HTTP status **and** the envelope's `error.code`, never the
 * status alone: the two 401 codes mean opposite things. Only
 * `401 ERR_TOKEN_EXPIRED` is recoverable — 403, `ERR_TOKEN_INVALID` and every
 * 4xx/5xx/network outcome must never trigger a renewal.
 *
 * @param isReplay BR-05's one-shot retry marker. A request is replayed exactly
 * once; a replayed request that fails again terminates rather than retrying.
 */
async function requestWithRetry<T>(
  method: string,
  url: string,
  body?: unknown,
  responseType: 'json' | 'blob' = 'json',
  isReplay = false,
): Promise<T> {
  const tokenBeforeRequest = getAuthToken()

  try {
    return await request<T>(method, url, body, responseType)
  } catch (err) {
    // Network failure, timeout, abort — the token was never the problem.
    if (!(err instanceof HttpError)) throw err

    if (err.status === 403) {
      // A suspended account ends access, but not as a generic logout: the user
      // is told why (BR-06, AC-04.2). Every other 403 — ERR_PERMISSION_DENIED
      // and friends — leaves the session valid; the user simply lacks that
      // permission.
      if (err.code === 'ERR_ACCOUNT_SUSPENDED') terminateSession('SUSPENDED')
      throw err
    }

    if (err.status !== 401) throw err

    // A malformed, tampered or cross-pool token is not an expiry problem —
    // terminate without ever attempting a renewal (BR-06c, AC-03.3/03.4).
    if (err.code === 'ERR_TOKEN_INVALID') {
      terminateSession('INVALID')
      throw err
    }

    if (err.code === 'ERR_TOKEN_EXPIRED' && !isReplay && tokenBeforeRequest) {
      try {
        await renewSession(tokenBeforeRequest)
      } catch {
        // Expired, revoked or rotated-out refresh token; disabled user;
        // network failure — all terminal (BR-06a). The renewal error itself is
        // swallowed so the caller sees the original 401.
        terminateSession('EXPIRED')
        throw err
      }
      return await requestWithRetry<T>(method, url, body, responseType, true)
    }

    // Everything else that reaches here is terminal: a second 401 on a replay
    // (BR-06b), or a 401 carrying any other code. A 401 with no session at all
    // is left alone — there is no refresh token to exchange (BR-08), and
    // terminateSession is a no-op without one.
    terminateSession('EXPIRED')
    throw err
  }
}

// ── Public API ─────────────────────────────────────────────────
export const httpClient = {
  get<T>(url: string): Promise<T> {
    return requestWithRetry<T>('GET', url)
  },

  getBlob(url: string): Promise<Blob> {
    return requestWithRetry<Blob>('GET', url, undefined, 'blob')
  },

  post<T>(url: string, body: unknown): Promise<T> {
    return requestWithRetry<T>('POST', url, body)
  },

  put<T>(url: string, body: unknown): Promise<T> {
    return requestWithRetry<T>('PUT', url, body)
  },

  patch<T>(url: string, body: unknown): Promise<T> {
    return requestWithRetry<T>('PATCH', url, body)
  },

  delete<T = void>(url: string): Promise<T> {
    return requestWithRetry<T>('DELETE', url)
  },
}
