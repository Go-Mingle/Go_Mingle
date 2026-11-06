import { resetSessionLostLatch } from './sessionEvents'
import type { AuthIdentity } from './types'

/**
 * The access token key is the one `httpClient` already reads for its Bearer
 * header. Nothing wrote it before this module existed, which is why the
 * Authorization header was never actually sent.
 */
const ACCESS_TOKEN_KEY = 'auth-token'
const REFRESH_TOKEN_KEY = 'auth-refresh-token'
const EXPIRY_KEY = 'auth-token-expiry'
const IDENTITY_KEY = 'auth-identity'

/**
 * `localStorage.setItem(k, undefined)` stores the *string* "undefined", which is
 * truthy — so a missing token would look like a real session and every request
 * would go out as `Authorization: Bearer undefined`, drawing a 401 that looks
 * like an expired session rather than the bug it is. Treat those as absent.
 */
const NON_VALUES = new Set(['undefined', 'null', ''])

/** localStorage throws in private-mode Safari and when quota is exhausted. */
function read(key: string): string | null {
  try {
    const value = localStorage.getItem(key)
    return value !== null && NON_VALUES.has(value) ? null : value
  } catch {
    return null
  }
}

function isUsableToken(value: unknown): value is string {
  return typeof value === 'string' && !NON_VALUES.has(value)
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable — the session degrades to in-memory for this tab */
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export interface StoredTokens {
  accessToken: string
  refreshToken: string
  /** Unix ms. */
  expiresAt: number
  identity?: AuthIdentity
}

export const tokenStore = {
  getAccessToken: (): string | null => read(ACCESS_TOKEN_KEY),

  getRefreshToken: (): string | null => read(REFRESH_TOKEN_KEY),

  /** Unix ms, or null when nothing is stored or the value is unparseable. */
  getExpiresAt: (): number | null => {
    const raw = read(EXPIRY_KEY)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  },

  getIdentity: (): AuthIdentity | null => {
    const raw = read(IDENTITY_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as AuthIdentity
    } catch {
      return null
    }
  },

  /**
   * Rejects a malformed session rather than persisting it. Storing a missing
   * token would turn a contract mismatch into a stream of confusing 401s far
   * from the cause; failing here names the problem at the point it happens.
   */
  setTokens: ({ accessToken, refreshToken, expiresAt, identity }: StoredTokens): void => {
    if (!isUsableToken(accessToken) || !isUsableToken(refreshToken)) {
      throw new Error(
        'tokenStore.setTokens: refusing to store a session without both an access and a refresh token',
      )
    }
    write(ACCESS_TOKEN_KEY, accessToken)
    write(REFRESH_TOKEN_KEY, refreshToken)
    write(EXPIRY_KEY, String(expiresAt))
    if (identity) write(IDENTITY_KEY, JSON.stringify(identity))
    // A new session re-arms the one-shot session-lost latch. Doing it here
    // rather than in each journey means login, signup and any future entry
    // point get it for free.
    resetSessionLostLatch()
  },

  /** Replaces only the access token — used by the silent-renewal path. */
  setAccessToken: (accessToken: string, expiresAt: number): void => {
    if (!isUsableToken(accessToken)) {
      throw new Error('tokenStore.setAccessToken: refusing to store an empty access token')
    }
    write(ACCESS_TOKEN_KEY, accessToken)
    write(EXPIRY_KEY, String(expiresAt))
  },

  clear: (): void => {
    remove(ACCESS_TOKEN_KEY)
    remove(REFRESH_TOKEN_KEY)
    remove(EXPIRY_KEY)
    remove(IDENTITY_KEY)
  },

  /** True when an access token is present. Expiry is the server's call, not ours. */
  hasSession: (): boolean => Boolean(read(ACCESS_TOKEN_KEY)),
}
