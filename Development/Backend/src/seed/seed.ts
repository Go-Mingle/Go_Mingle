import { eq } from 'drizzle-orm'
import type { Db } from '../db/database'
import { adminUsers, meta, partnerUsers, roles } from '../db/schema'
import { hashPassword } from '../auth/passwords'
import { initialsOf, today } from '../common/time'
import { SEED_ADMIN, SEED_PARTNER } from './accounts'

/** Steps that fill a fresh install; each runs once (recorded in `meta`). */
export type SeedStep = { key: string; run: (db: Db) => Promise<void> }

const steps: SeedStep[] = []

/** Modules add their own first-run data (catalogues, the partner's restaurant…). */
export function registerSeed(step: SeedStep) {
  if (!steps.some((s) => s.key === step.key)) steps.push(step)
}

async function done(db: Db, key: string) {
  const [row] = await db.select().from(meta).where(eq(meta.key, key))
  return Boolean(row)
}

/**
 * A fresh install has the Super Admin role, the Admin account and the Partner
 * account (with its empty Draft restaurant), plus the starter pick-lists.
 * Nothing else: every category, restaurant, Mingler and booking is entered by
 * the team.
 */
export async function seed(db: Db): Promise<void> {
  if (!(await done(db, 'accounts'))) {
    const now = new Date().toISOString()
    await db
      .insert(roles)
      .values({ id: 'r1', name: 'Super Admin', fullAccess: true, permissions: [] })
      .onConflictDoNothing()
    await db
      .insert(adminUsers)
      .values({
        id: SEED_ADMIN.id,
        fullName: SEED_ADMIN.fullName,
        username: SEED_ADMIN.email.split('@')[0],
        email: SEED_ADMIN.email,
        roleId: SEED_ADMIN.roleId,
        status: 'ACTIVE',
        lastActive: today(),
        createdAt: now,
        initials: initialsOf(SEED_ADMIN.fullName),
        passwordHash: hashPassword(SEED_ADMIN.password),
      })
      .onConflictDoNothing()
    await db
      .insert(partnerUsers)
      .values({
        id: SEED_PARTNER.id,
        restaurantId: SEED_PARTNER.restaurantId,
        email: SEED_PARTNER.email,
        fullName: SEED_PARTNER.fullName,
        designation: 'Owner',
        status: 'ACTIVE',
        isPrimary: true,
        lastActiveAt: today(),
        createdAt: now,
        passwordHash: hashPassword(SEED_PARTNER.password),
      })
      .onConflictDoNothing()
    await db.insert(meta).values({ key: 'accounts', value: now })
  }
  for (const step of steps) {
    if (await done(db, step.key)) continue
    await step.run(db)
    await db.insert(meta).values({ key: step.key, value: new Date().toISOString() })
  }
}
