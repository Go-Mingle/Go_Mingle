import crypto from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq, lt } from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import type { Request } from 'express'
import { config } from '../config'
import { DB, type Db } from '../db/database'
import { refreshTokens } from '../db/schema'

export const ADMIN_AUDIENCE = 'gomingle-admin'
export const PARTNER_AUDIENCE = 'gomingle-partner'
export type Audience = typeof ADMIN_AUDIENCE | typeof PARTNER_AUDIENCE

export interface TokenSubject {
  id: string
  email: string
  fullName: string
  roleName: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
}

export interface AccessClaims {
  sub: string
  email: string
  name: string
  role: string
}

/**
 * JWT issuing and verification (HS256).
 *
 * `aud` separates the two portals: an admin token is rejected by every partner
 * route and vice versa. Refresh tokens are opaque random strings stored in
 * PostgreSQL, so logout and password changes revoke them.
 */
@Injectable()
export class TokensService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async issue(user: TokenSubject, audience: Audience): Promise<TokenPair> {
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, name: user.fullName, role: user.roleName },
      config.jwtSecret,
      { algorithm: 'HS256', audience, issuer: 'gomingle-api', expiresIn: config.accessTokenTtlSeconds },
    )
    const refreshToken = crypto.randomBytes(32).toString('base64url')
    await this.db.insert(refreshTokens).values({
      token: refreshToken,
      userId: user.id,
      audience,
      expiresAt: Date.now() + config.refreshTokenTtlSeconds * 1000,
    })
    return { accessToken, refreshToken, expiresIn: config.accessTokenTtlSeconds, tokenType: 'Bearer' }
  }

  /**
   * Verifies an access token for one portal. The error codes are the two both
   * portals' HTTP clients branch on (only "expired" triggers a refresh).
   */
  verify(token: string | null, audience: Audience): { claims?: AccessClaims; error?: 'ERR_TOKEN_EXPIRED' | 'ERR_TOKEN_INVALID' } {
    if (!token) return { error: 'ERR_TOKEN_INVALID' }
    try {
      const claims = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], audience, issuer: 'gomingle-api' })
      return { claims: claims as AccessClaims }
    } catch (err) {
      return { error: (err as Error)?.name === 'TokenExpiredError' ? 'ERR_TOKEN_EXPIRED' : 'ERR_TOKEN_INVALID' }
    }
  }

  /** Consumes a refresh token (rotation); returns the user id it belonged to, or null. */
  async consume(token: unknown, audience: Audience): Promise<string | null> {
    if (typeof token !== 'string' || !token) return null
    const [row] = await this.db.delete(refreshTokens).where(eq(refreshTokens.token, token)).returning()
    if (!row || row.audience !== audience || row.expiresAt < Date.now()) return null
    return row.userId
  }

  async revokeUser(userId: string): Promise<void> {
    await this.db.delete(refreshTokens).where(eq(refreshTokens.userId, userId))
  }

  async purgeExpired(): Promise<void> {
    await this.db.delete(refreshTokens).where(and(lt(refreshTokens.expiresAt, Date.now())))
  }
}

export function bearer(req: Request): string | null {
  const header = req.headers.authorization ?? ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null
}
