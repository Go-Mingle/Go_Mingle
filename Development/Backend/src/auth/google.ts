import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

/** The parts of a Google ID token GoMingle uses. */
export interface GoogleIdentity {
  sub: string
  email: string
  name: string
}

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'] as const

let cache: { keys: Map<string, crypto.KeyObject>; until: number } | null = null

/** Test hook: lets tests sign tokens with their own key. */
export function setGoogleKeysForTests(keys: Record<string, crypto.KeyObject> | null) {
  cache = keys ? { keys: new Map(Object.entries(keys)), until: Number.MAX_SAFE_INTEGER } : null
}

async function keyFor(kid: string): Promise<crypto.KeyObject | null> {
  if (!cache || cache.until < Date.now() || !cache.keys.has(kid)) {
    const res = await fetch(CERTS_URL, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) throw new Error(`Google keys answered ${res.status}`)
    const body = (await res.json()) as { keys: (crypto.JsonWebKey & { kid: string })[] }
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600)
    cache = {
      keys: new Map(body.keys.map((k) => [k.kid, crypto.createPublicKey({ key: k, format: 'jwk' })])),
      until: Date.now() + maxAge * 1000,
    }
  }
  return cache.keys.get(kid) ?? null
}

export type GoogleCheck = { ok: true; identity: GoogleIdentity } | { ok: false; reason: string }

/**
 * Verifies a Google Identity Services credential (an ID token): Google's
 * signature, our client id as audience, Google as issuer, not expired, and a
 * verified email.
 */
export async function verifyGoogleCredential(credential: unknown, clientId: string): Promise<GoogleCheck> {
  if (typeof credential !== 'string' || credential.split('.').length !== 3) return { ok: false, reason: 'malformed' }
  const decoded = jwt.decode(credential, { complete: true })
  const kid = decoded && typeof decoded === 'object' ? decoded.header.kid : undefined
  if (!kid) return { ok: false, reason: 'no key id' }
  const key = await keyFor(kid)
  if (!key) return { ok: false, reason: 'unknown key' }
  try {
    const claims = jwt.verify(credential, key, {
      algorithms: ['RS256'],
      audience: clientId,
      issuer: [...ISSUERS],
      clockTolerance: 30,
    }) as jwt.JwtPayload
    const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : ''
    const verified = claims.email_verified === true || claims.email_verified === 'true'
    if (!claims.sub || !email) return { ok: false, reason: 'no email' }
    if (!verified) return { ok: false, reason: 'email not verified' }
    const name = typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : email.split('@')[0]
    return { ok: true, identity: { sub: String(claims.sub), email, name } }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'invalid' }
  }
}
