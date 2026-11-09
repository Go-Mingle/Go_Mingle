import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { config } from '../config.js'
import { db, save } from '../db/store.js'

/**
 * Credential store for portal users (admins and restaurant partners).
 *
 * Passwords are bcrypt-hashed; nothing stores or logs a plain password.
 * Domain data (restaurants, Minglers, bookings, finances) lives in the contract
 * modules — this store only answers "who is signing in, and may they".
 */

// Accounts live in the persistent store; this map is the in-memory index.
const users = new Map() // email -> user
for (const user of db.users) users.set(user.email, user)

/** Password policy shared by both portals: 8+ chars, upper, lower, digit, symbol. */
export function meetsPasswordPolicy(password) {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

export function normaliseEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

export function createUser({ id, email, fullName, password, portal, role, status = 'ACTIVE', restaurantId, teamMemberId }) {
  const user = {
    id: id ?? `${portal}-${crypto.randomUUID()}`,
    restaurantId,
    teamMemberId,
    email: normaliseEmail(email),
    fullName,
    portal, // 'admin' | 'partner'
    role, // admin: { id, name, permissions, fullAccess }
    roleName: role?.name ?? portal,
    status,
    passwordHash: password ? bcrypt.hashSync(password, 10) : null,
    createdAt: new Date().toISOString(),
    failures: 0,
    lockedUntil: 0,
  }
  users.set(user.email, user)
  db.users.push(user)
  save()
  return user
}

/** Persists changes made to a user object in place. */
export function touchUser() {
  save()
}

export function findUser(email, portal) {
  const user = users.get(normaliseEmail(email))
  // A deleted account no longer exists as far as sign-in is concerned.
  return user && user.portal === portal && user.status !== 'DELETED' ? user : null
}

export function findUserById(id) {
  for (const user of users.values()) if (user.id === id) return user
  return null
}

export function checkPassword(user, password) {
  return Boolean(user?.passwordHash) && bcrypt.compareSync(String(password ?? ''), user.passwordHash)
}

export function setPassword(user, password) {
  user.passwordHash = bcrypt.hashSync(password, 10)
  save()
}

// ── Lockout: 5 consecutive failures lock the account for 15 minutes ─────────

export function lockRemainingMs(user) {
  return user && user.lockedUntil > Date.now() ? user.lockedUntil - Date.now() : 0
}

/** Records a failure; returns attempts remaining (0 = now locked). */
export function recordFailure(user) {
  if (!user) return config.lockout.maxFailures - 1
  user.failures += 1
  if (user.failures >= config.lockout.maxFailures) {
    user.lockedUntil = Date.now() + config.lockout.lockMinutes * 60_000
    user.failures = 0
    save()
    return 0
  }
  save()
  return config.lockout.maxFailures - user.failures
}

export function recordSuccess(user) {
  if (user.failures || user.lockedUntil) save()
  user.failures = 0
  user.lockedUntil = 0
}

// ── One-time codes (password reset, sign-up) ────────────────────────────────

const codes = new Map() // `${purpose}:${email}` -> { code, expiresAt }

export function issueCode(purpose, email, minutes = 10) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  codes.set(`${purpose}:${normaliseEmail(email)}`, { code, expiresAt: Date.now() + minutes * 60_000 })
  console.log(`[otp] ${purpose} code for ${normaliseEmail(email)}: ${code} (demo code ${config.demoOtp} also accepted)`)
  return code
}

/** 'ok' | 'mismatch' | 'expired' */
export function checkCode(purpose, email, code) {
  const key = `${purpose}:${normaliseEmail(email)}`
  const record = codes.get(key)
  if (!record) return code === config.demoOtp ? 'ok' : 'expired'
  if (record.expiresAt < Date.now()) return 'expired'
  if (code !== record.code && code !== config.demoOtp) return 'mismatch'
  return 'ok'
}

export function clearCode(purpose, email) {
  codes.delete(`${purpose}:${normaliseEmail(email)}`)
}

// ── Seed accounts ──────────────────────────────────────────────────────────

export const SEED_ACCOUNTS = [
  {
    id: 'u-default-1',
    email: 'admin@gomingle.com',
    password: 'Admin@123',
    fullName: 'Hira Mansoor',
    portal: 'admin',
    role: { id: 'r1', name: 'Super Admin', permissions: [], fullAccess: true },
  },
  {
    id: 'u1',
    email: 'partner@gomingle.com',
    password: 'Partner@123',
    fullName: 'Hira Mansoor',
    portal: 'partner',
    restaurantId: 'rest1',
  },
]

export function seedUsers() {
  for (const account of SEED_ACCOUNTS) {
    if (!users.has(account.email)) createUser(account)
  }
}

export function allUsers() {
  return [...users.values()]
}
