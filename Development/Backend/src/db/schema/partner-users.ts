import { bigint, boolean, integer, pgTable, serial, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Partner Portal users: the restaurant owner (isPrimary) and the team members
 * the owner adds. Each row is both the Team-screen record and the sign-in
 * account. Removing a member marks it DELETED.
 */
export const partnerUsers = pgTable(
  'partner_users',
  {
    id: text('id').primaryKey(),
    seq: serial('seq').notNull(),
    restaurantId: text('restaurant_id').notNull(),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    designation: text('designation').notNull().default(''),
    /** ACTIVE | SUSPENDED | DELETED */
    status: text('status').notNull().default('ACTIVE'),
    isPrimary: boolean('is_primary').notNull().default(false),
    lastActiveAt: text('last_active_at'),
    createdAt: text('created_at').notNull(),
    passwordHash: text('password_hash'),
    failures: integer('failures').notNull().default(0),
    lockedUntil: bigint('locked_until', { mode: 'number' }).notNull().default(0),
  },
  (t) => [uniqueIndex('partner_users_email_live').on(t.email).where(sql`${t.status} <> 'DELETED'`)],
)
