import crypto from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, isNull, ne } from 'drizzle-orm'
import type { Request } from 'express'
import { config } from '../../config'
import { DB, type Db } from '../../db/database'
import { adminSessions, adminUsers, settings } from '../../db/schema'
import {
  hashBackupCode,
  newBackupCodes,
  newTotpSecret,
  normaliseBackupCode,
  openSecret,
  otpauthUrl,
  sealSecret,
  totpStep,
  verifyTotp,
} from '../../auth/totp'
import type { AdminUserRow } from './admin-accounts.service'

export type AdminSessionRow = typeof adminSessions.$inferSelect

const POLICY_KEY = 'admin-security'
/** Last-seen is written at most this often, so every request isn't a write. */
const TOUCH_EVERY_MS = 60_000

export interface SecurityPolicy {
  /** Every admin must turn on two-step sign-in before using the panel. */
  requireTwoStep: boolean
}

/**
 * Admin account security (GM-346): two-step sign-in with an authenticator app
 * plus backup codes, sign-in sessions that can be signed out one by one, and
 * the panel-wide "require two-step sign-in" policy.
 */
@Injectable()
export class AdminSecurityService {
  private policyCache: { value: SecurityPolicy; at: number } | null = null

  constructor(@Inject(DB) private readonly db: Db) {}

  // ── Policy ────────────────────────────────────────────────────────────────

  async policy(): Promise<SecurityPolicy> {
    if (this.policyCache && Date.now() - this.policyCache.at < 10_000) return this.policyCache.value
    const [row] = await this.db.select().from(settings).where(eq(settings.key, POLICY_KEY))
    const value = { requireTwoStep: Boolean(row?.value?.requireTwoStep) }
    this.policyCache = { value, at: Date.now() }
    return value
  }

  async setPolicy(value: SecurityPolicy): Promise<SecurityPolicy> {
    const v = { requireTwoStep: Boolean(value.requireTwoStep) }
    await this.db
      .insert(settings)
      .values({ key: POLICY_KEY, value: v })
      .onConflictDoUpdate({ target: settings.key, set: { value: v } })
    this.policyCache = { value: v, at: Date.now() }
    return v
  }

  // ── Two-step sign-in ──────────────────────────────────────────────────────

  enabled = (u: AdminUserRow) => Boolean(u.totpEnabledAt && u.totpSecret)

  /** Starts set-up: a new secret, kept pending until a code confirms it. */
  async beginSetup(u: AdminUserRow) {
    const secret = newTotpSecret()
    await this.db
      .update(adminUsers)
      .set({ totpPendingSecret: sealSecret(secret, config.jwtSecret) })
      .where(eq(adminUsers.id, u.id))
    return { secret, otpauthUrl: otpauthUrl(secret, u.email) }
  }

  /** Confirms set-up with a code from the app; returns the backup codes (shown once). */
  async confirmSetup(u: AdminUserRow, code: unknown): Promise<string[] | null> {
    const secret = u.totpPendingSecret ? openSecret(u.totpPendingSecret, config.jwtSecret) : null
    if (!secret) return null
    const step = verifyTotp(secret, code)
    if (step === null) return null
    const codes = newBackupCodes()
    await this.db
      .update(adminUsers)
      .set({
        totpSecret: sealSecret(secret, config.jwtSecret),
        totpPendingSecret: null,
        totpEnabledAt: new Date().toISOString(),
        totpLastStep: step,
        backupCodes: codes.map(hashBackupCode),
      })
      .where(eq(adminUsers.id, u.id))
    return codes
  }

  async disable(u: AdminUserRow) {
    await this.db
      .update(adminUsers)
      .set({ totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: 0, backupCodes: [] })
      .where(eq(adminUsers.id, u.id))
  }

  async newBackupCodes(u: AdminUserRow): Promise<string[]> {
    const codes = newBackupCodes()
    await this.db.update(adminUsers).set({ backupCodes: codes.map(hashBackupCode) }).where(eq(adminUsers.id, u.id))
    return codes
  }

  /**
   * The second sign-in step: a code from the app (each code works once) or an
   * unused backup code (used up). Returns how it passed, or null.
   */
  async checkSecondStep(u: AdminUserRow, code: unknown): Promise<'totp' | 'backup' | null> {
    const secret = u.totpSecret ? openSecret(u.totpSecret, config.jwtSecret) : null
    if (!secret) return null
    const step = verifyTotp(secret, code, Date.now(), u.totpLastStep)
    if (step !== null) {
      // Conditional update: two requests with the same code can't both pass.
      const done = await this.db
        .update(adminUsers)
        .set({ totpLastStep: step })
        .where(and(eq(adminUsers.id, u.id), eq(adminUsers.totpLastStep, u.totpLastStep)))
        .returning({ id: adminUsers.id })
      return done.length ? 'totp' : null
    }
    const typed = normaliseBackupCode(code)
    if (typed.length !== 8) return null
    const hash = hashBackupCode(typed)
    if (!u.backupCodes.includes(hash)) return null
    const left = u.backupCodes.filter((h) => h !== hash)
    await this.db.update(adminUsers).set({ backupCodes: left }).where(eq(adminUsers.id, u.id))
    return 'backup'
  }

  status(u: AdminUserRow, policy: SecurityPolicy) {
    return {
      enabled: this.enabled(u),
      enabledAt: u.totpEnabledAt,
      backupCodesLeft: this.enabled(u) ? u.backupCodes.length : 0,
      required: policy.requireTwoStep,
      currentStep: totpStep(),
    }
  }

  // ── Sessions ──────────────────────────────────────────────────────────────

  async createSession(userId: string, req: Request, method: string): Promise<string> {
    const id = `s-${crypto.randomBytes(12).toString('base64url')}`
    const now = new Date().toISOString()
    await this.db.insert(adminSessions).values({
      id,
      userId,
      userAgent: String(req.headers['user-agent'] ?? '').slice(0, 400),
      ip: clientIp(req),
      method,
      createdAt: now,
      lastSeenAt: now,
    })
    return id
  }

  /** True while the session is signed in; refreshes its last-seen time now and then. */
  async touch(sessionId: string, userId: string): Promise<boolean> {
    const [s] = await this.db.select().from(adminSessions).where(eq(adminSessions.id, sessionId))
    if (!s || s.userId !== userId || s.revokedAt) return false
    if (Date.now() - Date.parse(s.lastSeenAt) > TOUCH_EVERY_MS) {
      await this.db
        .update(adminSessions)
        .set({ lastSeenAt: new Date().toISOString() })
        .where(eq(adminSessions.id, sessionId))
    }
    return true
  }

  async list(userId: string): Promise<AdminSessionRow[]> {
    return this.db
      .select()
      .from(adminSessions)
      .where(and(eq(adminSessions.userId, userId), isNull(adminSessions.revokedAt)))
      .orderBy(desc(adminSessions.lastSeenAt))
  }

  /** Signs one session out. Returns false when it isn't this admin's or is already out. */
  async revoke(userId: string, sessionId: string): Promise<boolean> {
    const rows = await this.db
      .update(adminSessions)
      .set({ revokedAt: new Date().toISOString() })
      .where(and(eq(adminSessions.id, sessionId), eq(adminSessions.userId, userId), isNull(adminSessions.revokedAt)))
      .returning({ id: adminSessions.id })
    return rows.length > 0
  }

  /** Signs out every session of the admin except `keep`; returns how many. */
  async revokeOthers(userId: string, keep: string | null): Promise<string[]> {
    const where = keep
      ? and(eq(adminSessions.userId, userId), isNull(adminSessions.revokedAt), ne(adminSessions.id, keep))
      : and(eq(adminSessions.userId, userId), isNull(adminSessions.revokedAt))
    const rows = await this.db
      .update(adminSessions)
      .set({ revokedAt: new Date().toISOString() })
      .where(where)
      .returning({ id: adminSessions.id })
    return rows.map((r) => r.id)
  }
}

/** The caller's address (Vercel and most proxies put it first in x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
  return (fwd || req.socket?.remoteAddress || '').slice(0, 64)
}
