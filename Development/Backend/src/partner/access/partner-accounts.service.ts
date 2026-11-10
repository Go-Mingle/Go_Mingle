import crypto from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, ne } from 'drizzle-orm'
import { config } from '../../config'
import { DB, type Db } from '../../db/database'
import { partnerUsers } from '../../db/schema'
import { hashPassword, normaliseEmail } from '../../auth/passwords'
import { today } from '../../common/time'

export type PartnerUser = typeof partnerUsers.$inferSelect

/** Partner Portal accounts: restaurant owners and their team members. */
@Injectable()
export class PartnerAccountsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** A live (not deleted) partner user by email. */
  async byEmail(email: unknown): Promise<PartnerUser | null> {
    const [row] = await this.db
      .select()
      .from(partnerUsers)
      .where(and(eq(partnerUsers.email, normaliseEmail(email)), ne(partnerUsers.status, 'DELETED')))
    return row ?? null
  }

  async byId(id: string): Promise<PartnerUser | null> {
    const [row] = await this.db.select().from(partnerUsers).where(eq(partnerUsers.id, id))
    return row ?? null
  }

  /** The restaurant's owner (the partner who signed up). */
  async owner(restaurantId: string): Promise<PartnerUser | null> {
    const [row] = await this.db
      .select()
      .from(partnerUsers)
      .where(and(eq(partnerUsers.restaurantId, restaurantId), eq(partnerUsers.isPrimary, true)))
    return row ?? null
  }

  async create(values: {
    email: string
    fullName: string
    restaurantId: string
    isPrimary: boolean
    designation?: string
    password?: string | null
    status?: string
    /** Team members have not signed in yet. */
    neverActive?: boolean
  }): Promise<PartnerUser> {
    const [row] = await this.db
      .insert(partnerUsers)
      .values({
        id: `pu-${crypto.randomBytes(6).toString('hex')}`,
        restaurantId: values.restaurantId,
        email: normaliseEmail(values.email),
        fullName: values.fullName,
        designation: values.designation ?? (values.isPrimary ? 'Owner' : ''),
        status: values.status ?? 'ACTIVE',
        isPrimary: values.isPrimary,
        lastActiveAt: values.neverActive ? null : today(),
        createdAt: new Date().toISOString(),
        passwordHash: values.password ? hashPassword(values.password) : null,
      })
      .returning()
    return row
  }

  /** Everyone on a restaurant's team, removed members included, in the order they were added. */
  team(restaurantId: string): Promise<PartnerUser[]> {
    return this.db.select().from(partnerUsers).where(eq(partnerUsers.restaurantId, restaurantId)).orderBy(asc(partnerUsers.seq))
  }

  async update(id: string, changes: Partial<PartnerUser>): Promise<PartnerUser> {
    const [row] = await this.db.update(partnerUsers).set(changes).where(eq(partnerUsers.id, id)).returning()
    return row
  }

  setPassword(id: string, password: string) {
    return this.update(id, { passwordHash: hashPassword(password) })
  }

  // ── Lockout: 5 consecutive failures lock the account for 15 minutes ───────

  lockRemainingMs(user: PartnerUser | null): number {
    return user && user.lockedUntil > Date.now() ? user.lockedUntil - Date.now() : 0
  }

  /** Records a failure; returns attempts remaining (0 = now locked). */
  async recordFailure(user: PartnerUser | null): Promise<number> {
    const { maxFailures, lockMinutes } = config.lockout
    if (!user) return maxFailures - 1
    const failures = user.failures + 1
    if (failures >= maxFailures) {
      await this.update(user.id, { failures: 0, lockedUntil: Date.now() + lockMinutes * 60_000 })
      return 0
    }
    await this.update(user.id, { failures })
    return maxFailures - failures
  }

  async recordSuccess(user: PartnerUser): Promise<void> {
    if (user.failures || user.lockedUntil) await this.update(user.id, { failures: 0, lockedUntil: 0 })
  }
}
