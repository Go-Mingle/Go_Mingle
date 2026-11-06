import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'

/**
 * JWT issuing and verification (HS256).
 *
 * `aud` separates the two portals: an admin token is rejected by every partner
 * route and vice versa. Refresh tokens are opaque random strings held
 * server-side, so logout and password changes can revoke them.
 */

const refreshTokens = new Map() // token -> { userId, audience, expiresAt }

export function issueTokens(user, audience) {
  const accessToken = jwt.sign(
    { sub: user.id, email: user.email, name: user.fullName, role: user.roleName ?? audience },
    config.jwtSecret,
    { algorithm: 'HS256', audience, issuer: 'gomingle-api', expiresIn: config.accessTokenTtlSeconds },
  )
  const refreshToken = crypto.randomBytes(32).toString('base64url')
  refreshTokens.set(refreshToken, {
    userId: user.id,
    audience,
    expiresAt: Date.now() + config.refreshTokenTtlSeconds * 1000,
  })
  return { accessToken, refreshToken, expiresIn: config.accessTokenTtlSeconds, tokenType: 'Bearer' }
}

/**
 * Verifies an access token for one portal.
 * Returns `{ claims }` or `{ error: 'ERR_TOKEN_EXPIRED' | 'ERR_TOKEN_INVALID' }` —
 * the two codes both portals' HTTP clients branch on (only "expired" refreshes).
 */
export function verifyAccessToken(token, audience) {
  if (!token) return { error: 'ERR_TOKEN_INVALID' }
  try {
    const claims = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
      audience,
      issuer: 'gomingle-api',
    })
    return { claims }
  } catch (err) {
    return { error: err?.name === 'TokenExpiredError' ? 'ERR_TOKEN_EXPIRED' : 'ERR_TOKEN_INVALID' }
  }
}

export function bearer(req) {
  const header = req.headers.authorization ?? ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null
}

/** Consumes a refresh token (rotation) and returns its record, or null. */
export function consumeRefreshToken(token, audience) {
  const record = refreshTokens.get(token)
  if (!record) return null
  refreshTokens.delete(token)
  if (record.audience !== audience || record.expiresAt < Date.now()) return null
  return record
}

export function revokeUserRefreshTokens(userId) {
  for (const [token, record] of refreshTokens) {
    if (record.userId === userId) refreshTokens.delete(token)
  }
}
