/**
 * Token redaction for anything leaving the app (FE1 BR-11).
 *
 * "Neither access nor refresh tokens appear in logs, analytics, error reports
 * or crash traces." The risk here is not deliberate logging — it is the generic
 * paths that ship whole payloads, notably `httpClient` attaching an error
 * response body to its Sentry report. An auth endpoint's body can carry a
 * session, so scrub rather than trust that it never will.
 */

export const REDACTED = '[redacted]'

/**
 * A compact JWS: three base64url segments, the first starting `eyJ` because
 * every JOSE header begins `{"`. Matches the token wherever it sits — bare, or
 * embedded in an `Authorization: Bearer …` header inside a larger string.
 */
const JWT_PATTERN = /eyJ[\w-]*\.[\w-]+\.[\w-]*/g

/** Keys whose value is a credential regardless of the shape it arrives in. */
const SECRET_KEYS = new Set([
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'idtoken',
  'id_token',
  'authorization',
  'auth-token',
  'auth-refresh-token',
  'bearertoken',
  'bearer_token',
  'password',
  'session',
])

function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key.toLowerCase())
}

function scrubString(value: string): string {
  return value.replace(JWT_PATTERN, REDACTED)
}

/**
 * Returns a copy with every credential replaced by {@link REDACTED}.
 *
 * Recurses through plain objects and arrays. Cyclic references are tolerated —
 * a payload built from a parsed response body should never contain one, but a
 * scrubber that can throw would take the error report down with it.
 */
export function scrubTokens<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value === 'string') return scrubString(value) as T
  if (value === null || typeof value !== 'object') return value

  if (seen.has(value)) return REDACTED as T
  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((item) => scrubTokens(item, seen)) as T
  }

  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = isSecretKey(key) ? REDACTED : scrubTokens(item, seen)
  }
  return output as T
}
