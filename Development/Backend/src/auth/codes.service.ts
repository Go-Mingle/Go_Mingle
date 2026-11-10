import crypto from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { config } from '../config'
import { DB, type Db } from '../db/database'
import { oneTimeCodes, resetSessions } from '../db/schema'
import { normaliseEmail } from './passwords'
import type { Audience } from './tokens.service'

export type CodeResult = 'ok' | 'mismatch' | 'expired'

/**
 * One-time codes (password reset, partner sign-up). Codes are printed to the
 * server console; the demo code (DEMO_OTP, default 123456) is accepted too.
 */
@Injectable()
export class CodesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async issue(purpose: string, email: string, minutes = 10): Promise<string> {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
    const key = `${purpose}:${normaliseEmail(email)}`
    const expiresAt = Date.now() + minutes * 60_000
    await this.db
      .insert(oneTimeCodes)
      .values({ key, code, expiresAt })
      .onConflictDoUpdate({ target: oneTimeCodes.key, set: { code, expiresAt } })
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[otp] ${purpose} code for ${normaliseEmail(email)}: ${code} (demo code ${config.demoOtp} also accepted)`)
    }
    return code
  }

  async check(purpose: string, email: string, code: string): Promise<CodeResult> {
    const [record] = await this.db
      .select()
      .from(oneTimeCodes)
      .where(eq(oneTimeCodes.key, `${purpose}:${normaliseEmail(email)}`))
    if (!record) return code === config.demoOtp ? 'ok' : 'expired'
    if (record.expiresAt < Date.now()) return 'expired'
    if (code !== record.code && code !== config.demoOtp) return 'mismatch'
    return 'ok'
  }

  async clear(purpose: string, email: string): Promise<void> {
    await this.db.delete(oneTimeCodes).where(eq(oneTimeCodes.key, `${purpose}:${normaliseEmail(email)}`))
  }

  /** A reset session lets the holder set a new password for 15 minutes. */
  async openResetSession(userId: string, audience: Audience): Promise<string> {
    const token = crypto.randomBytes(24).toString('base64url')
    await this.db.insert(resetSessions).values({ token, userId, audience, expiresAt: Date.now() + 15 * 60_000 })
    return token
  }

  /** The user id behind a live reset session, or null. */
  async resetSessionUser(token: unknown, audience: Audience): Promise<string | null> {
    if (typeof token !== 'string' || !token) return null
    const [row] = await this.db.select().from(resetSessions).where(eq(resetSessions.token, token))
    if (!row || row.audience !== audience || row.expiresAt <= Date.now()) return null
    return row.userId
  }

  async closeResetSession(token: string): Promise<void> {
    await this.db.delete(resetSessions).where(eq(resetSessions.token, token))
  }
}
