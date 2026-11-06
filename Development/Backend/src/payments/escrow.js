import crypto from 'node:crypto'
import { db, save } from '../db/store.js'
import { admin } from '../contracts/registry.js'
import * as safepay from './safepay.js'

/**
 * Escrow ledger — Mingler payments held by GoMingle until the dining event
 * is completed, then paid out to the restaurant net of the platform fee.
 *
 *   AUTHORIZED  card hold placed at booking (Safepay authorize, no capture)
 *       │ capture (24-hour confirmation)          │ void (cancelled in time)
 *       ▼                                          ▼
 *   IN_ESCROW   collected, held by GoMingle      VOIDED
 *       │ release (event completed)               │ refund (dispute / cancellation)
 *       ▼                                          ▼
 *   RELEASED    net paid to restaurant IBAN      REFUNDED
 */

export const PLATFORM_FEE_PCT = Number(process.env.PLATFORM_FEE_PCT ?? 10)

const ledger = () => (db.escrow ??= { holds: {}, seeded: false })

const now = () => new Date().toISOString()
const round = (n) => Math.round(n * 100) / 100

export class EscrowError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

// ── Payout accounts (replaces card-network onboarding) ──────────────────────

/** Pakistani IBAN: PK + 2 check digits + 4-letter bank code + 16 digits (24 chars). */
export function normaliseIban(iban) {
  return String(iban ?? '').replace(/\s+/g, '').toUpperCase()
}

export function isValidPkIban(iban) {
  const v = normaliseIban(iban)
  if (!/^PK\d{2}[A-Z]{4}\d{16}$/.test(v)) return false
  // ISO 13616 mod-97 check.
  const moved = v.slice(4) + v.slice(0, 4)
  const digits = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  let rem = 0
  for (const ch of digits) rem = (rem * 10 + Number(ch)) % 97
  return rem === 1
}

export function maskIban(iban) {
  const v = normaliseIban(iban)
  return v ? `${v.slice(0, 4)} •••• ${v.slice(-4)}` : ''
}

export function payoutAccount(restaurantId) {
  return db.restaurants[restaurantId]?.payoutAccount ?? null
}

// ── Holds ───────────────────────────────────────────────────────────────────

function restaurantName(id) {
  return db.restaurants[id]?.profile?.name ?? admin.mockRestaurants.find((r) => r.id === id)?.name ?? id
}

function view(h) {
  const fee = round((h.amount * h.platformFeePct) / 100)
  return {
    ...h,
    restaurantName: restaurantName(h.restaurantId),
    platformFee: fee,
    restaurantNet: round(h.amount - fee),
    payoutTo: h.payout?.ibanMasked ?? (payoutAccount(h.restaurantId) ? maskIban(payoutAccount(h.restaurantId).iban) : null),
  }
}

function push(h, event, by, note) {
  h.status = event
  h.updatedAt = now()
  h.timeline.push({ status: event, at: h.updatedAt, by, ...(note ? { note } : {}) })
}

export async function createHold({ restaurantId, minglerName, guests, amountPerGuest, eventName, eventAt, by = 'Mingler app' }) {
  const amount = round(Number(guests) * Number(amountPerGuest))
  if (!(amount > 0)) throw new EscrowError(422, 'ERR_VALIDATION', 'Amount must be greater than zero.')
  const id = `esc-${crypto.randomBytes(4).toString('hex')}`
  const auth = await safepay.authorize({ amount, orderId: id })
  const h = {
    id,
    bookingRef: `GM-${Math.floor(100000 + Math.random() * 900000)}`,
    restaurantId,
    minglerName,
    guests: Number(guests),
    amount,
    currency: 'PKR',
    platformFeePct: PLATFORM_FEE_PCT,
    eventName: eventName ?? 'Interest Table',
    eventAt: eventAt ?? now(),
    gateway: safepay.gateway.name,
    tracker: auth.tracker,
    createdAt: now(),
    timeline: [],
  }
  push(h, auth.state === 'AUTHORIZED' ? 'AUTHORIZED' : 'PENDING_PAYMENT', by)
  ledger().holds[id] = h
  save()
  return view(h)
}

function find(id) {
  const h = ledger().holds[id]
  if (!h) throw new EscrowError(404, 'ERR_NOT_FOUND', 'Escrow transaction not found.')
  return h
}

function expect(h, status, action) {
  if (h.status !== status) {
    throw new EscrowError(409, 'ERR_INVALID_STATE', `Cannot ${action} a transaction that is ${h.status.replace('_', ' ').toLowerCase()}.`)
  }
}

export async function capture(id, by) {
  const h = find(id)
  if (h.status === 'PENDING_PAYMENT' && (await safepay.status(h.tracker)) !== 'UNKNOWN') push(h, 'AUTHORIZED', 'Safepay')
  expect(h, 'AUTHORIZED', 'capture')
  await safepay.capture(h.tracker)
  push(h, 'IN_ESCROW', by)
  save()
  return view(h)
}

export async function voidHold(id, by, reason) {
  const h = find(id)
  expect(h, 'AUTHORIZED', 'void')
  await safepay.voidHold(h.tracker)
  push(h, 'VOIDED', by, reason)
  save()
  return view(h)
}

export async function refund(id, by, reason) {
  const h = find(id)
  expect(h, 'IN_ESCROW', 'refund')
  if (!reason) throw new EscrowError(422, 'ERR_VALIDATION', 'A reason is required to refund.')
  await safepay.refund(h.tracker, h.amount)
  push(h, 'REFUNDED', by, reason)
  save()
  return view(h)
}

/** Pays the restaurant's share out of escrow to its registered bank account. */
export function release(id, by) {
  const h = find(id)
  expect(h, 'IN_ESCROW', 'release')
  const account = payoutAccount(h.restaurantId)
  if (!account) {
    throw new EscrowError(409, 'ERR_NO_PAYOUT_ACCOUNT', 'This restaurant has not added a payout bank account yet.')
  }
  const v = view(h)
  h.payout = {
    reference: `PO-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    amount: v.restaurantNet,
    platformFee: v.platformFee,
    accountTitle: account.accountTitle,
    bank: account.bankName,
    ibanMasked: maskIban(account.iban),
    paidAt: now(),
  }
  push(h, 'RELEASED', by)
  save()
  return view(h)
}

export function list({ restaurantId, status } = {}) {
  return Object.values(ledger().holds)
    .filter((h) => (!restaurantId || h.restaurantId === restaurantId) && (!status || h.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(view)
}

export function summary(restaurantId) {
  const sum = (status, field = 'amount') =>
    round(list({ restaurantId, status }).reduce((t, h) => t + (field === 'net' ? h.restaurantNet : field === 'fee' ? h.platformFee : h.amount), 0))
  return {
    currency: 'PKR',
    authorized: sum('AUTHORIZED'),
    inEscrow: sum('IN_ESCROW'),
    released: sum('RELEASED', 'net'),
    refunded: sum('REFUNDED'),
    platformFees: sum('RELEASED', 'fee'),
    platformFeePct: PLATFORM_FEE_PCT,
    count: list({ restaurantId }).length,
  }
}

// ── Demo seed ───────────────────────────────────────────────────────────────

export async function seedEscrow() {
  const l = ledger()
  if (l.seeded) {
    safepay.restoreSimulated(Object.values(l.holds))
    return
  }
  l.seeded = true
  const plan = [
    ['rest1', 'Sana Khan', 4, 3200, 'Founders & Filter Coffee', 'RELEASED'],
    ['rest1', 'Osama Khalil', 2, 2800, 'Sufi Night Supper Club', 'IN_ESCROW'],
    ['rest1', 'Hira Mansoor', 3, 3500, 'Startup Founders Brunch', 'AUTHORIZED'],
    ['rest2', 'Laiba Hassan', 5, 2600, 'Book Club Biryani', 'IN_ESCROW'],
    ['rest3', 'Parveen Rizvi', 2, 4100, 'Chai & Poetry Evening', 'REFUNDED'],
    ['rest2', 'Danish Ahmed', 4, 2900, 'Gaming Night', 'VOIDED'],
  ]
  for (const [restaurantId, minglerName, guests, per, eventName, target] of plan) {
    const h = await createHold({ restaurantId, minglerName, guests, amountPerGuest: per, eventName })
    if (target === 'VOIDED') await voidHold(h.id, 'System', 'Cancelled before the 24-hour mark')
    if (['IN_ESCROW', 'RELEASED', 'REFUNDED'].includes(target)) await capture(h.id, 'System (24-hour confirmation)')
    if (target === 'REFUNDED') await refund(h.id, 'Hira Mansoor', 'Event cancelled by restaurant')
    if (target === 'RELEASED') {
      const rec = (db.restaurants.rest1 ??= { id: 'rest1', createdAt: now(), amenityIds: [], seededData: true })
      rec.payoutAccount ??= {
        accountTitle: 'Aurelia Dining (Pvt) Ltd',
        bankName: 'Meezan Bank',
        iban: 'PK40MEZN0000001123456702',
      }
      release(h.id, 'System (event completed)')
    }
  }
  save()
}
