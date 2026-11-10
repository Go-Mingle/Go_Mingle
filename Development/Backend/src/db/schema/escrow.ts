import { doublePrecision, integer, jsonb, pgTable, serial, text } from 'drizzle-orm/pg-core'

export interface EscrowEvent {
  status: string
  at: string
  by: string
  note?: string
}

export interface EscrowPayout {
  reference: string
  amount: number
  platformFee: number
  accountTitle: string
  bank: string
  ibanMasked: string
  paidAt: string
}

/**
 * Escrow ledger: a Mingler's payment for a booking, held by GoMingle until the
 * dinner is done, then paid to the restaurant net of the platform fee.
 *
 *   AUTHORIZED  card hold placed at booking (Safepay authorize, no capture)
 *       │ capture                                  │ void (cancelled in time)
 *       ▼                                          ▼
 *   IN_ESCROW   collected, held by GoMingle      VOIDED
 *       │ release (event completed)               │ refund
 *       ▼                                          ▼
 *   RELEASED    net paid to the restaurant       REFUNDED
 */
export const escrowHolds = pgTable('escrow_holds', {
  id: text('id').primaryKey(),
  seq: serial('seq').notNull(),
  bookingRef: text('booking_ref').notNull(),
  restaurantId: text('restaurant_id').notNull(),
  minglerName: text('mingler_name').notNull(),
  guests: integer('guests').notNull(),
  /** PKR (rupees) */
  amount: doublePrecision('amount').notNull(),
  currency: text('currency').notNull().default('PKR'),
  platformFeePct: doublePrecision('platform_fee_pct').notNull(),
  eventName: text('event_name').notNull(),
  eventAt: text('event_at').notNull(),
  gateway: text('gateway').notNull(),
  /** Safepay tracker token */
  tracker: text('tracker').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  timeline: jsonb('timeline').$type<EscrowEvent[]>().notNull().default([]),
  payout: jsonb('payout').$type<EscrowPayout | null>(),
  /** PAYMENT: money for the dinner. NO_SHOW_HOLD: the penalty reserved at booking (GM-203). */
  kind: text('kind').notNull().default('PAYMENT'),
  bookingId: text('booking_id'),
  /**
   * Penalty holds are placed one per seat (Safepay cannot collect part of a
   * hold), so a no-show collects the empty seats' holds in full and lets the
   * others go. This is the seat's number within its booking.
   */
  seatNo: integer('seat_no'),
  /** Set when the capture is requested, so the same capture is never sent twice. */
  idempotencyKey: text('idempotency_key').unique(),
})

/**
 * Payment operations that failed at the gateway and need a person to look at
 * them (the dead-letter queue). Nothing here is retried silently.
 */
export const paymentFailures = pgTable('payment_failures', {
  seq: serial('seq').primaryKey(),
  holdId: text('hold_id'),
  bookingId: text('booking_id'),
  /** capture | void */
  action: text('action').notNull(),
  amount: doublePrecision('amount'),
  message: text('message').notNull(),
  at: text('at').notNull(),
  attempts: integer('attempts').notNull().default(1),
  resolvedAt: text('resolved_at'),
  resolvedBy: text('resolved_by'),
  /** How it ended: RETRIED (the retry went through) or DISMISSED (settled by hand, with a note). */
  resolution: text('resolution'),
  resolutionNote: text('resolution_note'),
})
