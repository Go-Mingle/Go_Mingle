import crypto from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { and, count, eq, gt, sql } from 'drizzle-orm'
import { config } from '../config'
import { DB, type Db } from '../db/database'
import { emailLog, oneTimeCodes, resetSessions } from '../db/schema'
import { apiError } from '../common/errors'
import { normaliseEmail } from './passwords'
import type { Audience } from './tokens.service'
import { MailService } from '../shared/email/mail.service'
import { mailConfigured } from '../shared/email/mail-transport'

export type CodeResult = 'ok' | 'mismatch' | 'expired'

/** Wrong guesses a code survives; after that a new code has to be requested. */
export const MAX_CODE_ATTEMPTS = 5
/** Codes one address can be sent per SEND_WINDOW_MINUTES, so nobody can flood an inbox. */
export const MAX_CODES_PER_WINDOW = 5
const SEND_WINDOW_MINUTES = 15

/** The email each kind of code goes out in. */
const TEMPLATE_FOR: Record<string, string> = {
  'partner-signup': 'partner_signup_code',
  'partner-reset': 'partner_password_reset',
  'admin-reset': 'admin_password_reset',
}

/**
 * One-time codes (password reset, partner sign-up), emailed to the person.
 * Until email delivery is configured they are printed to the server console
 * and the demo code (DEMO_OTP, default 123456) is accepted as well.
 */
@Injectable()
export class CodesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly mail: MailService,
  ) {}

  async issue(purpose: string, email: string, minutes = 10, name?: string | null): Promise<string> {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
    const key = `${purpose}:${normaliseEmail(email)}`
    const template = TEMPLATE_FOR[purpose]
    if (template) await this.throttle(template, normaliseEmail(email))
    const expiresAt = Date.now() + minutes * 60_000
    await this.db
      .insert(oneTimeCodes)
      .values({ key, code, expiresAt, attempts: 0 })
      .onConflictDoUpdate({ target: oneTimeCodes.key, set: { code, expiresAt, attempts: 0 } })
    if (process.env.NODE_ENV !== 'test' && !mailConfigured()) {
      const demo = config.demoOtp ? ` (demo code ${config.demoOtp} also accepted)` : ''
      console.log(`[otp] ${purpose} code for ${normaliseEmail(email)}: ${code}${demo}`)
    }
    if (template) {
      await this.mail.send(template, { email: normaliseEmail(email), name }, { code, minutes, name: name || normaliseEmail(email).split('@')[0] })
    }
    return code
  }

  async check(purpose: string, email: string, code: string): Promise<CodeResult> {
    const [record] = await this.db
      .select()
      .from(oneTimeCodes)
      .where(eq(oneTimeCodes.key, `${purpose}:${normaliseEmail(email)}`))
    const demo = Boolean(config.demoOtp) && code === config.demoOtp
    if (!record) return demo ? 'ok' : 'expired'
    if (record.expiresAt < Date.now() || record.attempts >= MAX_CODE_ATTEMPTS) return 'expired'
    if (code !== record.code && !demo) {
      // Six digits are a million guesses: a handful of wrong ones and the code is gone.
      await this.db
        .update(oneTimeCodes)
        .set({ attempts: sql`${oneTimeCodes.attempts} + 1` })
        .where(eq(oneTimeCodes.key, record.key))
      return 'mismatch'
    }
    return 'ok'
  }

  /** Refuses a new code when this address was already sent several in the last few minutes. */
  private async throttle(template: string, email: string): Promise<void> {
    const since = new Date(Date.now() - SEND_WINDOW_MINUTES * 60_000).toISOString()
    const [row] = await this.db
      .select({ n: count() })
      .from(emailLog)
      .where(and(eq(emailLog.templateKey, template), eq(emailLog.toEmail, email), gt(emailLog.createdAt, since)))
    if ((row?.n ?? 0) >= MAX_CODES_PER_WINDOW) {
      throw apiError(429, 'ERR_TOO_MANY_REQUESTS', `Too many codes sent to this address. Please wait ${SEND_WINDOW_MINUTES} minutes and try again.`)
    }
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
