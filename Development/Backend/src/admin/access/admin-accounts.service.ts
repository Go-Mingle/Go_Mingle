import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, ne, sql } from 'drizzle-orm'
import { config } from '../../config'
import { DB, type Db } from '../../db/database'
import { adminUsers, roles } from '../../db/schema'
import { normaliseEmail } from '../../auth/passwords'

export type AdminUserRow = typeof adminUsers.$inferSelect
export type RoleRow = typeof roles.$inferSelect

/** The role as the sign-in account carries it (with permissions, for /auth/me). */
export interface SessionRole {
  id: string
  name: string
  permissions: string[]
  fullAccess: boolean
}

/** A signed-in admin: the users row plus its live role. */
export interface AdminSession extends AdminUserRow {
  role: SessionRole | null
}

/**
 * Admin accounts: lookups, lockout and the profile /auth/me returns.
 * The same rows back the Users screen (see users.service.ts).
 */
@Injectable()
export class AdminAccountsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async role(roleId: string): Promise<SessionRole | null> {
    const [r] = await this.db.select().from(roles).where(eq(roles.id, roleId))
    return r ? { id: r.id, name: r.name, permissions: r.permissions ?? [], fullAccess: Boolean(r.fullAccess) } : null
  }

  private async withRole(row: AdminUserRow | undefined): Promise<AdminSession | null> {
    if (!row) return null
    return { ...row, role: await this.role(row.roleId) }
  }

  /** A live (not deleted) admin by email. */
  async byEmail(email: unknown): Promise<AdminSession | null> {
    const [row] = await this.db
      .select()
      .from(adminUsers)
      .where(and(eq(adminUsers.email, normaliseEmail(email)), ne(adminUsers.status, 'DELETED')))
    return this.withRole(row)
  }

  async byId(id: string): Promise<AdminSession | null> {
    const [row] = await this.db.select().from(adminUsers).where(eq(adminUsers.id, id))
    return this.withRole(row)
  }

  /** Every admin (for cross-portal email checks). */
  async liveEmails(): Promise<string[]> {
    const rows = await this.db
      .select({ email: adminUsers.email })
      .from(adminUsers)
      .where(ne(adminUsers.status, 'DELETED'))
      .orderBy(asc(adminUsers.seq))
    return rows.map((r) => r.email)
  }

  profile(user: AdminSession) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    }
  }

  // ── Lockout: 5 consecutive failures lock the account for 15 minutes ───────

  lockRemainingMs(user: AdminUserRow | null): number {
    return user && user.lockedUntil > Date.now() ? user.lockedUntil - Date.now() : 0
  }

  /** Records a failure; returns attempts remaining (0 = now locked). */
  async recordFailure(user: AdminUserRow | null): Promise<number> {
    const { maxFailures, lockMinutes } = config.lockout
    if (!user) return maxFailures - 1
    const failures = user.failures + 1
    if (failures >= maxFailures) {
      await this.db
        .update(adminUsers)
        .set({ failures: 0, lockedUntil: Date.now() + lockMinutes * 60_000 })
        .where(eq(adminUsers.id, user.id))
      return 0
    }
    await this.db.update(adminUsers).set({ failures }).where(eq(adminUsers.id, user.id))
    return maxFailures - failures
  }

  async recordSuccess(user: AdminUserRow): Promise<void> {
    if (user.failures || user.lockedUntil) {
      await this.db.update(adminUsers).set({ failures: 0, lockedUntil: 0 }).where(eq(adminUsers.id, user.id))
    }
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db.update(adminUsers).set({ passwordHash }).where(eq(adminUsers.id, id))
  }

  async rename(id: string, fullName: string): Promise<void> {
    await this.db.update(adminUsers).set({ fullName }).where(eq(adminUsers.id, id))
  }

  /** Next Users-screen id: u1, u2, … */
  async nextUserId(): Promise<string> {
    const [row] = await this.db
      .select({ max: sql<number>`coalesce(max(nullif(regexp_replace(${adminUsers.id}, '^u(\\d+)$', '\\1'), ${adminUsers.id})::int), 0)` })
      .from(adminUsers)
    return `u${Number(row?.max ?? 0) + 1}`
  }
}
