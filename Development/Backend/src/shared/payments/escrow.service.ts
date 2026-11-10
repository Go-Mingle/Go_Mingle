import crypto from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { desc, eq } from 'drizzle-orm'
import { config } from '../../config'
import { DB, type Db } from '../../db/database'
import { escrowHolds, paymentFailures, restaurants } from '../../db/schema'
import { apiError } from '../../common/errors'
import { maskIban, PayoutService } from './payout.service'
import { SafepayService } from './safepay.service'

export type Hold = typeof escrowHolds.$inferSelect

const round = (n: number) => Math.round(n * 100) / 100
export const newBookingRef = () => `GM-${Math.floor(100000 + Math.random() * 900000)}`
const escrowError = (status: number, code: string, message: string) => apiError(status, code, message)

/** The escrow ledger. Every state change is written with who did it and when. */
@Injectable()
export class EscrowService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly safepay: SafepayService,
    private readonly payouts: PayoutService,
  ) {}

  /** A hold as the Escrow screens show it: with the fee split and where the payout goes. */
  async view(h: Hold) {
    const [restaurant] = await this.db.select({ name: restaurants.name }).from(restaurants).where(eq(restaurants.id, h.restaurantId))
    const account = await this.payouts.account(h.restaurantId)
    const platformFee = round((h.amount * h.platformFeePct) / 100)
    const { seq: _seq, payout, kind, bookingId, seatNo, idempotencyKey: _key, ...rest } = h
    return {
      ...rest,
      ...(payout ? { payout } : {}),
      // Only on penalty holds, so ordinary payments read as they always have.
      ...(kind !== 'PAYMENT' ? { kind, bookingId, seatNo } : {}),
      restaurantName: restaurant?.name ?? h.restaurantId,
      platformFee,
      restaurantNet: round(h.amount - platformFee),
      payoutTo: payout?.ibanMasked ?? (account ? maskIban(account.iban) : null),
    }
  }

  private async find(id: string): Promise<Hold> {
    const [h] = await this.db.select().from(escrowHolds).where(eq(escrowHolds.id, id))
    if (!h) throw escrowError(404, 'ERR_NOT_FOUND', 'Escrow transaction not found.')
    return h
  }

  private expect(h: Hold, status: string, action: string) {
    if (h.status !== status) {
      throw escrowError(409, 'ERR_INVALID_STATE', `Cannot ${action} a transaction that is ${h.status.replace('_', ' ').toLowerCase()}.`)
    }
  }

  private async move(h: Hold, status: string, by: string, note?: string, extra: Partial<Hold> = {}): Promise<Hold> {
    const at = new Date().toISOString()
    const [updated] = await this.db
      .update(escrowHolds)
      .set({ status, updatedAt: at, timeline: [...h.timeline, { status, at, by, ...(note ? { note } : {}) }], ...extra })
      .where(eq(escrowHolds.id, h.id))
      .returning()
    return updated
  }

  /** Places the card hold for a booking. */
  async createHold(input: {
    restaurantId: string
    minglerName: string
    guests: unknown
    amountPerGuest: unknown
    eventName?: unknown
    eventAt?: string
    by: string
    kind?: 'PAYMENT' | 'NO_SHOW_HOLD'
    bookingId?: string
    bookingRef?: string
    seatNo?: number
  }) {
    const amount = round(Number(input.guests) * Number(input.amountPerGuest))
    if (!(amount > 0)) throw escrowError(422, 'ERR_VALIDATION', 'Amount must be greater than zero.')
    const id = `esc-${crypto.randomBytes(4).toString('hex')}`
    const auth = await this.safepay.authorize(amount, id)
    const at = new Date().toISOString()
    const status = auth.state === 'AUTHORIZED' ? 'AUTHORIZED' : 'PENDING_PAYMENT'
    const [h] = await this.db
      .insert(escrowHolds)
      .values({
        id,
        bookingRef: input.bookingRef ?? newBookingRef(),
        kind: input.kind ?? 'PAYMENT',
        bookingId: input.bookingId ?? null,
        seatNo: input.seatNo ?? null,
        restaurantId: input.restaurantId,
        minglerName: input.minglerName,
        guests: Number(input.guests),
        amount,
        platformFeePct: config.platformFeePct,
        eventName: typeof input.eventName === 'string' && input.eventName ? input.eventName : 'Interest Table',
        eventAt: input.eventAt ?? at,
        gateway: this.safepay.gateway.name,
        tracker: auth.tracker,
        status,
        createdAt: at,
        updatedAt: at,
        timeline: [{ status, at, by: input.by }],
      })
      .returning()
    return this.view(h)
  }

  /** A no-show hold is settled by its booking (check-in, no-show, cancel), never by hand. */
  private notPenaltyHold(h: Hold, action: string) {
    if (h.kind === 'NO_SHOW_HOLD') {
      throw escrowError(409, 'ERR_INVALID_STATE', `A no-show hold can't be ${action} here. It is collected or released when the booking is checked in.`)
    }
  }

  async capture(id: string, by: string) {
    let h = await this.find(id)
    this.notPenaltyHold(h, 'captured')
    if (h.status === 'PENDING_PAYMENT' && (await this.safepay.isAuthorized(h.tracker))) h = await this.move(h, 'AUTHORIZED', 'Safepay')
    this.expect(h, 'AUTHORIZED', 'capture')
    await this.safepay.capture(h.tracker)
    return this.view(await this.move(h, 'IN_ESCROW', by))
  }

  async void(id: string, by: string, reason?: string) {
    const h = await this.find(id)
    this.notPenaltyHold(h, 'voided')
    this.expect(h, 'AUTHORIZED', 'void')
    await this.safepay.void(h.tracker)
    return this.view(await this.move(h, 'VOIDED', by, reason))
  }

  async refund(id: string, by: string, reason?: string) {
    const h = await this.find(id)
    this.expect(h, 'IN_ESCROW', 'refund')
    if (!reason) throw escrowError(422, 'ERR_VALIDATION', 'A reason is required to refund.')
    await this.safepay.refund(h.tracker, h.amount)
    return this.view(await this.move(h, 'REFUNDED', by, reason))
  }

  /** The card holds of a booking, by seat. */
  async holdsOfBooking(bookingId: string): Promise<Hold[]> {
    const rows = await this.db.select().from(escrowHolds).where(eq(escrowHolds.bookingId, bookingId))
    return rows.sort((x, y) => (x.seatNo ?? 0) - (y.seatNo ?? 0))
  }

  /**
   * No-show: collects one seat's penalty hold, in full, into escrow.
   * Safe to call twice: the second call finds the hold already collected.
   */
  async captureNoShow(id: string, by: string, note: string) {
    let h = await this.find(id)
    const key = `noshow:${h.id}`
    // Already collected by an earlier call with the same key.
    if (h.status === 'IN_ESCROW' && h.idempotencyKey === key) return this.view(h)
    // Live gateway: the hold exists only once the Mingler has completed the card step.
    if (h.status === 'PENDING_PAYMENT' && (await this.safepay.isAuthorized(h.tracker))) h = await this.move(h, 'AUTHORIZED', 'Safepay')
    if (h.status === 'PENDING_PAYMENT') throw new Error('The card hold was never completed by the Mingler, so there is nothing to collect.')
    if (h.status !== 'AUTHORIZED') throw new Error(`The card hold is ${h.status.replace('_', ' ').toLowerCase()} and cannot be collected.`)
    await this.safepay.capture(h.tracker)
    return this.view(await this.move(h, 'IN_ESCROW', by, note, { idempotencyKey: key }))
  }

  /** Lets a hold go without charging (guests arrived, or the booking was cancelled). */
  async releaseHold(id: string, by: string, note: string) {
    const h = await this.find(id)
    // A hold the Mingler never completed has nothing on the card to let go.
    if (h.status === 'PENDING_PAYMENT') return this.view(await this.move(h, 'VOIDED', by, `${note} (card hold was never completed)`))
    if (h.status !== 'AUTHORIZED') return this.view(h)
    await this.safepay.void(h.tracker)
    return this.view(await this.move(h, 'VOIDED', by, note))
  }

  /** Records a gateway failure for a person to resolve. */
  async recordFailure(f: { holdId: string | null; bookingId: string | null; action: string; amount: number | null; message: string }) {
    await this.db.insert(paymentFailures).values({ ...f, at: new Date().toISOString() })
  }

  /** Failures still waiting for a person, newest first, with what they concern. */
  async openFailures() {
    const rows = (await this.db.select().from(paymentFailures).orderBy(desc(paymentFailures.seq))).filter((f) => !f.resolvedAt)
    return Promise.all(
      rows.map(async (f) => {
        const [h] = f.holdId ? await this.db.select().from(escrowHolds).where(eq(escrowHolds.id, f.holdId)) : []
        const [restaurant] = h ? await this.db.select({ name: restaurants.name }).from(restaurants).where(eq(restaurants.id, h.restaurantId)) : []
        return {
          id: f.seq,
          action: f.action,
          amount: f.amount,
          message: f.message,
          at: f.at,
          attempts: f.attempts,
          holdId: f.holdId,
          bookingId: f.bookingId,
          bookingRef: h?.bookingRef ?? null,
          seatNo: h?.seatNo ?? null,
          minglerName: h?.minglerName ?? null,
          restaurantName: restaurant?.name ?? null,
          eventName: h?.eventName ?? null,
        }
      }),
    )
  }

  async failure(id: number) {
    const [f] = Number.isInteger(id) ? await this.db.select().from(paymentFailures).where(eq(paymentFailures.seq, id)) : []
    if (!f || f.resolvedAt) throw escrowError(404, 'ERR_NOT_FOUND', 'This failure was not found or is already resolved.')
    return f
  }

  async failedAgain(id: number, message: string) {
    const f = await this.failure(id)
    await this.db.update(paymentFailures).set({ attempts: f.attempts + 1, message, at: new Date().toISOString() }).where(eq(paymentFailures.seq, id))
  }

  async resolveFailure(id: number, by: string, resolution: 'RETRIED' | 'DISMISSED', note?: string) {
    await this.db
      .update(paymentFailures)
      .set({ resolvedAt: new Date().toISOString(), resolvedBy: by, resolution, resolutionNote: note ?? null })
      .where(eq(paymentFailures.seq, id))
  }

  /** Pays the restaurant's share out of escrow to its registered bank account. */
  async release(id: string, by: string) {
    const h = await this.find(id)
    this.expect(h, 'IN_ESCROW', 'release')
    const account = await this.payouts.account(h.restaurantId)
    if (!account) throw escrowError(409, 'ERR_NO_PAYOUT_ACCOUNT', 'This restaurant has not added a payout bank account yet.')
    const platformFee = round((h.amount * h.platformFeePct) / 100)
    const payout = {
      reference: `PO-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      amount: round(h.amount - platformFee),
      platformFee,
      accountTitle: account.accountTitle,
      bank: account.bankName,
      ibanMasked: maskIban(account.iban),
      paidAt: new Date().toISOString(),
    }
    return this.view(await this.move(h, 'RELEASED', by, undefined, { payout }))
  }

  /** Newest first. */
  async list(filter: { restaurantId?: string; status?: string } = {}) {
    const rows = await this.db.select().from(escrowHolds).orderBy(desc(escrowHolds.seq))
    return Promise.all(
      rows.filter((h) => (!filter.restaurantId || h.restaurantId === filter.restaurantId) && (!filter.status || h.status === filter.status)).map((h) => this.view(h)),
    )
  }

  async summary(restaurantId?: string) {
    const all = await this.list({ restaurantId })
    const sum = (status: string, pick: (h: (typeof all)[number]) => number = (h) => h.amount) =>
      round(all.filter((h) => h.status === status).reduce((t, h) => t + pick(h), 0))
    return {
      currency: 'PKR',
      authorized: sum('AUTHORIZED'),
      inEscrow: sum('IN_ESCROW'),
      released: sum('RELEASED', (h) => h.restaurantNet),
      refunded: sum('REFUNDED'),
      platformFees: sum('RELEASED', (h) => h.platformFee),
      platformFeePct: config.platformFeePct,
      count: all.length,
    }
  }
}
