import { bigint, boolean, index, integer, jsonb, pgTable, serial, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Admin Panel roles (Roles & Access). Soft-deleted: `deletedAt` set, row kept.
 * `seq` keeps creation order, which the role pickers list in.
 */
export const roles = pgTable('roles', {
  id: text('id').primaryKey(),
  seq: serial('seq').notNull(),
  name: text('name').notNull(),
  fullAccess: boolean('full_access').notNull().default(false),
  permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
  deletedAt: text('deleted_at'),
})

/**
 * Admin Panel users: the Users-screen record and the sign-in account in one row.
 * Deleting a user marks the row DELETED (it can no longer sign in and its email
 * can be used again).
 */
export const adminUsers = pgTable(
  'admin_users',
  {
    id: text('id').primaryKey(),
    seq: serial('seq').notNull(),
    fullName: text('full_name').notNull(),
    username: text('username').notNull(),
    email: text('email').notNull(),
    roleId: text('role_id').notNull(),
    /** ACTIVE | SUSPENDED | DELETED */
    status: text('status').notNull().default('ACTIVE'),
    lastActive: text('last_active').notNull(),
    createdAt: text('created_at').notNull(),
    initials: text('initials').notNull(),
    passwordHash: text('password_hash'),
    failures: integer('failures').notNull().default(0),
    lockedUntil: bigint('locked_until', { mode: 'number' }).notNull().default(0),
  },
  (t) => [
    uniqueIndex('admin_users_email_live')
      .on(t.email)
      .where(sql`${t.status} <> 'DELETED'`),
  ],
)

/** Refresh tokens: opaque, single use (rotated), revocable. */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    token: text('token').primaryKey(),
    userId: text('user_id').notNull(),
    audience: text('audience').notNull(),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  },
  (t) => [index('refresh_tokens_user').on(t.userId)],
)

/** One-time codes (password reset, partner sign-up), keyed `${purpose}:${email}`. */
export const oneTimeCodes = pgTable('one_time_codes', {
  key: text('key').primaryKey(),
  code: text('code').notNull(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  /** Wrong guesses so far; the code stops working after MAX_CODE_ATTEMPTS. */
  attempts: integer('attempts').notNull().default(0),
})

/** Short-lived sessions between "code verified" and "new password set". */
export const resetSessions = pgTable('reset_sessions', {
  token: text('token').primaryKey(),
  userId: text('user_id').notNull(),
  audience: text('audience').notNull(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
})
