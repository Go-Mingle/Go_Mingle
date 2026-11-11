import crypto from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { desc, eq } from 'drizzle-orm'
import { config } from '../../config'
import { DB, type Db } from '../../db/database'
import { categories, escrowHolds, paymentFailures, restaurants } from '../../db/schema'
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
    const { seq: _seq, payout, kind, bookingId, seatNo, idempotencyKey: _key, testCard, checkout, ...rest } = h
    return {
      ...rest,
      ...(payout ? { payout } : {}),
      // Only on penalty holds, so ordinary payments read as they always have.
      ...(kind !== 'PAYMENT' ? { kind, bookingId, seatNo } : {}),
      ...(testCard ? { testCard } : {}),
      ...(checkout ? { checkout } : {}),
      restaurantName: restaurant?.name ?? h.restaurantId,
      platformFee,
      restaurantNet: round(h.amount - platformFee),
      payoutTo: payout?.ibanMasked ?? (account ? maskIban(account.iban) : null),
    }
  }

  /**
   * GoMingle's share of what is collected for a restaurant: the commission
   * rate of its category, or the platform default when it has none. Noted on
   * each entry when it is created, so later rate changes never touch it.
   */
  private async feePct(restaurantId: string): Promise<number> {
    const [r] = await this.db.select({ categoryId: restaurants.categoryId }).from(restaurants).where(eq(restaurants.id, restaurantId))
    const [c] = r?.categoryId ? await this.db.select({ rate: categories.commissionRate }).from(categories).where(eq(categories.id, r.categoryId)) : []
    return typeof c?.rate === 'number' && c.rate >= 0 && c.rate <= 100 ? c.rate : config.platformFeePct
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
        platformFeePct: await this.feePct(input.restaurantId),
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

  /** Settled inside GoMingle only: a test card, or a simulated dinner bill. Never sent to Safepay. */
  private local(h: Hold) {
    return Boolean(h.testCard) || h.kind === 'BILL'
  }

  /** Paid in full on Safepay's checkout page. */
  private paidOnSafepay(h: Hold) {
    return Boolean(h.checkout?.paidAt)
  }

  /** A hold waiting for a Safepay checkout that has meanwhile been paid moves on by itself. */
  private async caughtUp(h: Hold): Promise<Hold> {
    if (h.status !== 'PENDING_PAYMENT' || !h.checkout || h.checkout.paidAt) return h
    if (!(await this.safepay.isPaid(h.tracker).catch(() => false))) return h
    await this.markCheckoutPaid(h.tracker)
    return this.find(h.id)
  }

  private async markCheckoutPaid(tracker: string): Promise<Hold[]> {
    const rows = (await this.db.select().from(escrowHolds).where(eq(escrowHolds.tracker, tracker))).filter((h) => h.status === 'PENDING_PAYMENT' && h.checkout)
    const paidAt = new Date().toISOString()
    const done: Hold[] = []
    for (const h of rows) {
      done.push(await this.move(h, 'AUTHORIZED', 'Safepay', `Paid on Safepay checkout (${tracker})`, { checkout: { ...h.checkout!, paidAt } }))
    }
    return done
  }

  /** Gives the money of a hold back, the way its card step calls for. */
  private async giveBack(h: Hold) {
    if (this.local(h)) return
    if (this.paidOnSafepay(h)) await this.safepay.refund(h.tracker, h.amount)
    else await this.safepay.void(h.tracker)
  }

  /** Takes the money of a hold. A Safepay checkout payment is already taken. */
  private async take(h: Hold) {
    if (this.local(h) || this.paidOnSafepay(h)) return
    await this.safepay.capture(h.tracker)
  }

  /**
   * Opens Safepay's checkout page for a hold that is waiting for a card. One
   * payment covers every waiting seat of the same booking.
   */
  async startCheckout(id: string, returnUrl: string, by: string) {
    const first = await this.find(id)
    const waiting = (first.bookingId ? await this.holdsOfBooking(first.bookingId) : [first]).filter((h) => h.status === 'PENDING_PAYMENT')
    if (waiting.length === 0) {
      throw escrowError(409, 'ERR_INVALID_STATE', `This hold is ${first.status.replace('_', ' ').toLowerCase()}; it is not waiting for a card.`)
    }
    const totalPkr = round(waiting.reduce((t, h) => t + h.amount, 0))
    const { tracker, url } = await this.safepay.startCheckout(totalPkr, first.bookingRef, returnUrl, returnUrl)
    const startedAt = new Date().toISOString()
    for (const h of waiting) {
      await this.db
        .update(escrowHolds)
        .set({
          tracker,
          checkout: { totalPkr, startedAt, paidAt: null },
          updatedAt: startedAt,
          timeline: [...h.timeline, { status: 'PENDING_PAYMENT', at: startedAt, by, note: `Safepay checkout opened (${tracker})` }],
        })
        .where(eq(escrowHolds.id, h.id))
    }
    return { url, tracker, totalPkr, seats: waiting.length, bookingRef: first.bookingRef }
  }

  /** Asks Safepay whether the checkout was paid and, if so, places the holds. */
  async confirmCheckout(id: string) {
    const h = await this.find(id)
    if (h.status !== 'PENDING_PAYMENT') return { paid: true, state: 'ALREADY_CONFIRMED', items: [await this.view(h)] }
    if (!h.checkout) throw escrowError(409, 'ERR_INVALID_STATE', 'No Safepay checkout has been opened for this hold yet.')
    const state = await this.safepay.trackerState(h.tracker)
    if (!['TRACKER_ENDED', 'PAID'].includes(state)) return { paid: false, state, items: [] }
    const done = await this.markCheckoutPaid(h.tracker)
    return { paid: true, state, items: await Promise.all(done.map((x) => this.view(x))) }
  }

  /**
   * The dinner bill of a booking, charged when its guests are checked in:
   * seat price × seats that arrived. It goes straight into escrow and is paid
   * to the restaurant, net of the platform fee, when an admin releases it.
   *
   * TEMPORARY (GM-255): until the Mingler app takes the payment on the
   * Mingler's saved card, this charge is simulated and never sent to Safepay.
   * Safe to call twice for the same booking.
   */
  async chargeBill(input: { bookingId: string; bookingRef: string; restaurantId: string; minglerName: string; seats: number; seatPricePkr: number; eventName: string; eventAt: string; by: string }) {
    const key = `bill:${input.bookingId}`
    const [existing] = await this.db.select().from(escrowHolds).where(eq(escrowHolds.idempotencyKey, key))
    if (existing) return this.view(existing)
    const amount = round(input.seats * input.seatPricePkr)
    if (!(amount > 0)) return null
    const id = `esc-${crypto.randomBytes(4).toString('hex')}`
    const at = new Date().toISOString()
    const note = `Dinner bill: ${input.seats} seat${input.seats === 1 ? '' : 's'} × PKR ${input.seatPricePkr} (simulated charge, not sent to Safepay)`
    const [h] = await this.db
      .insert(escrowHolds)
      .values({
        id,
        bookingRef: input.bookingRef,
        kind: 'BILL',
        bookingId: input.bookingId,
        restaurantId: input.restaurantId,
        minglerName: input.minglerName,
        guests: input.seats,
        amount,
        platformFeePct: await this.feePct(input.restaurantId),
        eventName: input.eventName,
        eventAt: input.eventAt,
        gateway: 'Simulated',
        tracker: `sim_${id}`,
        status: 'IN_ESCROW',
        createdAt: at,
        updatedAt: at,
        timeline: [{ status: 'IN_ESCROW', at, by: input.by, note }],
        idempotencyKey: key,
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
    h = await this.caughtUp(h)
    this.expect(h, 'AUTHORIZED', 'capture')
    await this.take(h)
    return this.view(await this.move(h, 'IN_ESCROW', by))
  }

  async void(id: string, by: string, reason?: string) {
    const h = await this.find(id)
    this.notPenaltyHold(h, 'voided')
    this.expect(h, 'AUTHORIZED', 'void')
    await this.giveBack(h)
    return this.view(await this.move(h, 'VOIDED', by, reason))
  }

  async refund(id: string, by: string, reason?: string) {
    const h = await this.find(id)
    this.expect(h, 'IN_ESCROW', 'refund')
    if (!reason) throw escrowError(422, 'ERR_VALIDATION', 'A reason is required to refund.')
    if (!this.local(h)) await this.safepay.refund(h.tracker, h.amount)
    return this.view(await this.move(h, 'REFUNDED', by, reason))
  }

  /**
   * TEMPORARY (GM-255): completes the card step of holds that are waiting for
   * it, with a test card typed in the Admin Panel. Covers every waiting hold of
   * the same booking, so a booking needs the card once, not once per seat.
   * From then on these holds are settled by the simulator, not by Safepay.
   */
  async addTestCard(id: string, card: { brand: string; last4: string }, by: string) {
    const first = await this.find(id)
    const holds = first.bookingId ? await this.holdsOfBooking(first.bookingId) : [first]
    const waiting = holds.filter((h) => h.status === 'PENDING_PAYMENT')
    if (waiting.length === 0) {
      throw escrowError(409, 'ERR_INVALID_STATE', `This hold is ${first.status.replace('_', ' ').toLowerCase()}; it is not waiting for a card.`)
    }
    const note = `Test card ${card.brand} •••• ${card.last4} (simulated, not sent to Safepay)`
    const done: Hold[] = []
    for (const h of waiting) done.push(await this.move(h, 'AUTHORIZED', by, note, { testCard: card, checkout: null }))
    return Promise.all(done.map((h) => this.view(h)))
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
    // The hold exists only once the card step has been completed.
    h = await this.caughtUp(h)
    if (h.status === 'PENDING_PAYMENT') throw new Error('No card was added for this seat, so there is nothing to collect. Add a card to the booking, then retry.')
    if (h.status !== 'AUTHORIZED') throw new Error(`The card hold is ${h.status.replace('_', ' ').toLowerCase()} and cannot be collected.`)
    await this.take(h)
    return this.view(await this.move(h, 'IN_ESCROW', by, note, { idempotencyKey: key }))
  }

  /** Lets a hold go without charging (guests arrived, or the booking was cancelled). */
  async releaseHold(id: string, by: string, note: string) {
    const h = await this.caughtUp(await this.find(id))
    // A hold nobody added a card to has nothing to give back.
    if (h.status === 'PENDING_PAYMENT') return this.view(await this.move(h, 'VOIDED', by, `${note} (no card was ever added)`))
    if (h.status !== 'AUTHORIZED') return this.view(h)
    await this.giveBack(h)
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
    // The rate the screens quote: the restaurant's own; across restaurants, what was actually taken.
    const gross = sum('RELEASED')
    const fees = sum('RELEASED', (h) => h.platformFee)
    const pct = restaurantId ? await this.feePct(restaurantId) : gross > 0 ? round((fees / gross) * 100) : config.platformFeePct
    return {
      currency: 'PKR',
      authorized: sum('AUTHORIZED'),
      inEscrow: sum('IN_ESCROW'),
      released: sum('RELEASED', (h) => h.restaurantNet),
      refunded: sum('REFUNDED'),
      platformFees: fees,
      platformFeePct: pct,
      count: all.length,
    }
  }
}
