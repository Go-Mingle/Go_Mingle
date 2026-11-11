import crypto from 'node:crypto'
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { bookings, interestTables, menuOptions, restaurants } from '../../db/schema'
import { apiError } from '../../common/errors'
import { InterestTablesService, type InterestTable } from '../interest-tables/interest-tables.service'
import { NotificationsService } from '../notifications/notifications.service'
import { EscrowService, newBookingRef } from '../payments/escrow.service'

export type Booking = typeof bookings.$inferSelect

const ACTIVE = ['PENDING', 'CONFIRMED']
/** How long after the start time staff have to check guests in before the automatic no-show. */
export const NO_SHOW_GRACE_MINUTES = 60
/** Guests can be checked in from this long before the start time. */
export const CHECK_IN_OPENS_MINUTES = 60
const CHECK_EVERY_MS = 15 * 60_000

const fmtPkr = (n: number) => `PKR ${Number(n).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`
const round = (n: number) => Math.round(n * 100) / 100

/** When a table starts. Dates and times of interest tables are Karachi time. */
export function startsAt(t: Pick<InterestTable, 'startDate' | 'startTime'>): number {
  return Date.parse(`${t.startDate}T${t.startTime ?? '00:00'}:00+05:00`)
}

/**
 * Bookings, guest check-in and the no-show penalty (GM-38, GM-203, GM-204).
 *
 *   booking made ──► card hold for penalty × seats (none when the penalty is 0);
 *        │           the seat price (the table's menu option) is noted on the booking
 *        │
 *        ├─ guests arrived ─► hold let go; the dinner bill (seat price × seats)
 *        │                    is charged into escrow and shows in Finances
 *        ├─ no-show (some or all seats) ─► penalty × empty seats collected into
 *        │                                 escrow, the rest of the hold let go;
 *        │                                 seats that did arrive are billed
 *        └─ cancelled ─► hold let go
 *
 * A no-show is recorded by staff, or by the check that runs every 15 minutes
 * for bookings nobody checked in within an hour of the start time.
 */
@Injectable()
export class BookingsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('NoShowCheck')
  private timer: NodeJS.Timeout | null = null

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly tables: InterestTablesService,
    private readonly escrow: EscrowService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    // On Vercel the check runs on incoming requests instead (see serverless.ts).
    if (process.env.NODE_ENV === 'test' || process.env.VERCEL) return
    this.timer = setInterval(() => {
      this.runNoShowCheck().catch((err) => this.log.error(`No-show check failed: ${err?.message ?? err}`))
    }, CHECK_EVERY_MS)
    this.timer.unref()
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  ofTable(interestTableId: string): Promise<Booking[]> {
    return this.db.select().from(bookings).where(eq(bookings.interestTableId, interestTableId)).orderBy(asc(bookings.seq))
  }

  /** By id or by booking reference. */
  async find(idOrRef: string): Promise<Booking | null> {
    const [byId] = await this.db.select().from(bookings).where(eq(bookings.id, idOrRef))
    if (byId) return byId
    const [byRef] = await this.db.select().from(bookings).where(eq(bookings.bookingRef, idOrRef))
    return byRef ?? null
  }

  // ── Booking ───────────────────────────────────────────────────────────────

  /**
   * Books seats at an interest table under the restaurant's current no-show
   * policy and reserves the penalty on the card.
   */
  async book(input: { interestTableId: string; minglerName: string; seats: unknown; menuOption?: string; fallbackSeatPricePkr?: number; by: string }) {
    const table = await this.tables.find(input.interestTableId)
    if (!table) throw apiError(404, 'ERR_INTEREST_TABLE_NOT_FOUND', 'Interest table not found.')
    if (!['PENDING', 'CONFIRMED'].includes(table.status)) {
      throw apiError(409, 'ERR_TABLE_NOT_BOOKABLE', 'This interest table is not open for booking.', { status: table.status })
    }
    const seats = Number(input.seats)
    if (!Number.isInteger(seats) || seats < 1) throw apiError(422, 'ERR_VALIDATION', 'Seats must be a whole number of 1 or more.')
    const seatsLeft = Math.max(0, (table.maxGuests ?? 0) - table.seatsBooked)
    if (seats > seatsLeft) throw apiError(409, 'ERR_TABLE_FULL', `Only ${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} left at this table.`, { seatsLeft })

    const [restaurant] = await this.db.select().from(restaurants).where(eq(restaurants.id, table.restaurantId))
    const menu = await this.menuOptionFor(table, input.menuOption)
    const penalty = restaurant?.noShowPenaltyPerSeatPkr ?? 0
    const id = `bk-${crypto.randomBytes(4).toString('hex')}`
    const bookingRef = newBookingRef()
    const now = new Date().toISOString()
    // The card holds come first: no holds, no booking. One hold per seat, because
    // Safepay cannot collect part of a hold: a no-show then collects the empty
    // seats' holds in full and lets the others go.
    const holds: Awaited<ReturnType<EscrowService['createHold']>>[] = []
    try {
      for (let seatNo = 1; penalty > 0 && seatNo <= seats; seatNo++) {
        holds.push(
          await this.escrow.createHold({
            restaurantId: table.restaurantId,
            minglerName: input.minglerName,
            guests: 1,
            amountPerGuest: penalty,
            eventName: table.name ?? 'Interest Table',
            eventAt: new Date(startsAt(table)).toISOString(),
            by: input.by,
            kind: 'NO_SHOW_HOLD',
            bookingId: id,
            bookingRef,
            seatNo,
          }),
        )
      }
    } catch (err) {
      // A booking with only some of its seats held would under-charge: undo and refuse.
      for (const h of holds) await this.escrow.releaseHold(h.id, input.by, 'Booking could not be completed').catch(() => undefined)
      throw err
    }
    const [booking] = await this.db
      .insert(bookings)
      .values({
        id,
        bookingRef,
        interestTableId: table.id,
        restaurantId: table.restaurantId,
        minglerName: input.minglerName,
        seats,
        menuOption: menu?.name ?? input.menuOption ?? '',
        // A table without a menu option has no price of its own; a sandbox booking may bring one.
        seatPricePkr: menu?.pricePkr ?? (input.fallbackSeatPricePkr && input.fallbackSeatPricePkr > 0 ? round(input.fallbackSeatPricePkr) : 0),
        status: 'CONFIRMED',
        penaltyPerSeatPkr: penalty,
        cancellationWindowHours: restaurant?.cancellationWindowHours ?? 24,
        escrowHoldId: holds[0]?.id ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    await this.db.update(interestTables).set({ seatsBooked: sql`${interestTables.seatsBooked} + ${seats}` }).where(eq(interestTables.id, table.id))
    return { booking, holds, heldTotalPkr: round(penalty * holds.length) }
  }

  /** Cancels a booking: the seats go back to the table and the card hold is let go. No charge. */
  async cancel(b: Booking, by: string): Promise<Booking | null> {
    const claimed = await this.claim(b.id, { status: 'CANCELLED' })
    if (!claimed) return null
    await this.db
      .update(interestTables)
      .set({ seatsBooked: sql`greatest(0, ${interestTables.seatsBooked} - ${b.seats})` })
      .where(eq(interestTables.id, b.interestTableId))
    await this.letHoldGo(claimed, by, 'Booking cancelled')
    return claimed
  }

  // ── Check-in ──────────────────────────────────────────────────────────────

  /**
   * "Guests Arrived": one action for the whole table. Every booking still
   * open is checked in, its card hold is let go and the table is completed.
   */
  async guestsArrived(table: InterestTable, by: string) {
    if (['CANCELLED', 'COMPLETED', 'DRAFT'].includes(table.status)) {
      throw apiError(409, 'ERR_INVALID_STATE', `Guests can't be checked in on a table that is ${table.status.toLowerCase()}.`, { status: table.status })
    }
    const opensAt = startsAt(table) - CHECK_IN_OPENS_MINUTES * 60_000
    if (Date.now() < opensAt) {
      throw apiError(409, 'ERR_TOO_EARLY', 'Guests can be checked in from one hour before the table starts.', { opensAt: new Date(opensAt).toISOString() })
    }
    const open = (await this.ofTable(table.id)).filter((b) => ACTIVE.includes(b.status))
    if (open.length === 0 && table.seatsBooked === 0) throw apiError(409, 'ERR_NO_BOOKINGS', 'There are no bookings to check in on this table.')

    let seats = 0
    for (const b of open) {
      const claimed = await this.claim(b.id, { status: 'COMPLETED', attendance: 'ARRIVED', arrivedSeats: b.seats, emptySeats: 0, checkedInBy: by })
      if (!claimed) continue
      seats += b.seats
      await this.letHoldGo(claimed, by, 'Guests arrived')
      await this.chargeBill(claimed, b.seats, table, by)
    }
    await this.tables.update(table.id, { status: 'COMPLETED' })
    await this.notifications.notifyAdmins({
      type: 'INTEREST_TABLE_COMPLETED',
      title: 'Guests arrived',
      body: `${by} checked in ${seats} guest${seats === 1 ? '' : 's'} at ${table.name}. The table is completed.`,
      deepLink: `/interest-tables/${table.id}`,
      metadata: { interestTableId: table.id, restaurantId: table.restaurantId, seats },
    })
    return { interestTableId: table.id, status: 'COMPLETED', bookingsCheckedIn: open.length, seatsArrived: seats }
  }

  /**
   * Records empty seats on a booking and collects the penalty for them.
   * `emptySeats` defaults to every seat.
   */
  async noShow(b: Booking, emptySeatsInput: unknown, by: string, automatic = false) {
    const table = await this.tables.find(b.interestTableId)
    const emptySeats = emptySeatsInput === undefined || emptySeatsInput === null ? b.seats : Number(emptySeatsInput)
    if (!Number.isInteger(emptySeats) || emptySeats < 1 || emptySeats > b.seats) {
      throw apiError(422, 'ERR_VALIDATION', `Empty seats must be between 1 and ${b.seats}.`, { fields: { emptySeats: `Enter a number between 1 and ${b.seats}.` } })
    }
    if (table && Date.now() < startsAt(table)) {
      throw apiError(409, 'ERR_TOO_EARLY', "A no-show can be recorded once the table's start time has passed.", { startsAt: new Date(startsAt(table)).toISOString() })
    }
    const due = round(b.penaltyPerSeatPkr * emptySeats)
    const claimed = await this.claim(b.id, {
      status: 'COMPLETED',
      attendance: emptySeats === b.seats ? 'NO_SHOW' : 'PARTIAL',
      arrivedSeats: b.seats - emptySeats,
      emptySeats,
      checkedInBy: by,
    })
    if (!claimed) throw apiError(409, 'ERR_BOOKING_NOT_ACTIVE', 'This booking has already been checked in or cancelled.', { status: b.status })

    // Collect the empty seats' holds in full, let the other seats' holds go.
    let charged = 0
    let failed = 0
    const holds = due > 0 ? (await this.escrow.holdsOfBooking(b.id)).filter((h) => ['AUTHORIZED', 'PENDING_PAYMENT'].includes(h.status)) : []
    const toCollect = holds.slice(0, emptySeats)
    for (const h of toCollect) {
      try {
        await this.escrow.captureNoShow(h.id, by, `No-show penalty: seat ${h.seatNo ?? '?'} of ${b.seats} stayed empty`)
        charged = round(charged + h.amount)
      } catch (err) {
        // Never silent: the booking shows the shortfall and the failure is queued for a person.
        failed += 1
        const message = err instanceof Error ? err.message : String(err)
        await this.escrow.recordFailure({ holdId: h.id, bookingId: b.id, action: 'capture', amount: h.amount, message })
      }
    }
    for (const h of holds.slice(emptySeats)) await this.letGo(h.id, b.id, by, 'Guests arrived on this seat')
    const penaltyStatus = due === 0 ? null : failed === 0 && toCollect.length === emptySeats ? 'CHARGED' : 'FAILED'
    if (penaltyStatus === 'FAILED') {
      await this.notifications.notifyAdmins({
        type: 'PAYMENT_FAILED',
        title: 'No-show penalty could not be collected',
        body: `${fmtPkr(round(due - charged))} of ${fmtPkr(due)} for booking ${b.bookingRef} was not collected. See Finances → Escrow & payouts → Failed collections.`,
        deepLink: '/finances/escrow',
        metadata: { bookingId: b.id },
      })
    }
    await this.db.update(bookings).set({ penaltyChargedPkr: charged, penaltyStatus }).where(eq(bookings.id, b.id))
    // Seats that did arrive had their dinner.
    if (table && emptySeats < b.seats) await this.chargeBill(claimed, b.seats - emptySeats, table, by)
    const [updated] = await this.db.select().from(bookings).where(eq(bookings.id, b.id))

    const what = `${emptySeats} of ${b.seats} seat${b.seats === 1 ? '' : 's'} empty for ${b.minglerName} (${b.bookingRef}) at ${table?.name ?? 'the table'}`
    const money = charged > 0 ? ` ${fmtPkr(charged)} penalty collected into escrow.` : due > 0 ? ' The penalty could not be collected yet.' : ' No penalty applies.'
    await this.notifications.notifyAdmins({
      type: 'BOOKING_NO_SHOW',
      title: 'No-show recorded',
      body: `${what}.${money}`,
      deepLink: `/interest-tables/${b.interestTableId}`,
      metadata: { bookingId: b.id, interestTableId: b.interestTableId, emptySeats, penaltyPkr: charged },
    })
    if (automatic) {
      await this.notifications.notifyPartner(b.restaurantId, {
        type: 'BOOKING_NO_SHOW',
        title: 'No-show recorded automatically',
        body: `Nobody was checked in within ${NO_SHOW_GRACE_MINUTES} minutes of the start time: ${what}.${money}`,
        deepLink: `/interest-tables/${b.interestTableId}`,
        metadata: { bookingId: b.id, interestTableId: b.interestTableId },
      })
    }
    // The table is done once nobody is left to check in.
    if (table && !['CANCELLED', 'COMPLETED'].includes(table.status)) {
      const left = (await this.ofTable(table.id)).filter((x) => ACTIVE.includes(x.status))
      if (left.length === 0) await this.tables.update(table.id, { status: 'COMPLETED' })
    }
    return updated
  }

  /**
   * The automatic no-show check (every 15 minutes): bookings nobody checked in
   * within the grace period after the start time become full no-shows.
   */
  async runNoShowCheck(now = Date.now()) {
    const open = await this.db.select().from(bookings).where(inArray(bookings.status, ACTIVE))
    let noShows = 0
    for (const b of open) {
      const table = await this.tables.find(b.interestTableId)
      if (!table || table.status === 'CANCELLED') continue
      if (now < startsAt(table) + NO_SHOW_GRACE_MINUTES * 60_000) continue
      try {
        await this.noShow(b, undefined, 'Automatic no-show check', true)
        noShows += 1
      } catch (err) {
        this.log.error(`Booking ${b.bookingRef}: ${err instanceof Error ? err.message : err}`)
      }
    }
    return { checked: open.length, noShows }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /** Moves a booking out of PENDING/CONFIRMED exactly once; null when someone else already did. */
  private async claim(id: string, changes: Partial<Booking>): Promise<Booking | null> {
    const [row] = await this.db
      .update(bookings)
      .set({ ...changes, updatedAt: new Date().toISOString() })
      .where(and(eq(bookings.id, id), inArray(bookings.status, ACTIVE)))
      .returning()
    return row ?? null
  }

  /**
   * The menu option a booking is priced at: the one asked for (by id or name)
   * when the table offers it, otherwise the table's first menu option.
   */
  private async menuOptionFor(table: InterestTable, asked?: string) {
    const ids = table.comboIds ?? []
    if (ids.length === 0) return null
    const offered = (await this.db.select().from(menuOptions).where(eq(menuOptions.restaurantId, table.restaurantId))).filter((m) => ids.includes(m.comboId))
    const wanted = (asked ?? '').trim().toLowerCase()
    const match = wanted ? offered.find((m) => m.comboId.toLowerCase() === wanted || m.name.toLowerCase() === wanted) : undefined
    return match ?? ids.map((id) => offered.find((m) => m.comboId === id)).find(Boolean) ?? null
  }

  /** Charges the dinner bill for the seats that arrived and notes it on the booking. */
  private async chargeBill(b: Booking, arrivedSeats: number, table: InterestTable, by: string) {
    if (!(b.seatPricePkr > 0) || arrivedSeats < 1) return
    const bill = await this.escrow.chargeBill({
      bookingId: b.id,
      bookingRef: b.bookingRef,
      restaurantId: b.restaurantId,
      minglerName: b.minglerName,
      seats: arrivedSeats,
      seatPricePkr: b.seatPricePkr,
      eventName: table.name ?? 'Interest Table',
      eventAt: new Date(startsAt(table)).toISOString(),
      by,
    })
    if (!bill) return
    await this.db.update(bookings).set({ billPkr: bill.amount, billHoldId: bill.id }).where(eq(bookings.id, b.id))
    await this.notifications.notifyPartner(b.restaurantId, {
      type: 'ESCROW_FUNDED',
      title: 'Payment held in escrow',
      body: `${fmtPkr(bill.amount)} for ${b.minglerName} (${b.bookingRef}) at ${table.name ?? 'the table'} is held in escrow and will be paid out to you, less the GoMingle fee.`,
      deepLink: '/finances',
      metadata: { escrowId: bill.id, bookingId: b.id },
    })
  }

  /** Lets every open card hold of a booking go. */
  private async letHoldGo(b: Booking, by: string, note: string) {
    for (const h of await this.escrow.holdsOfBooking(b.id)) {
      if (['AUTHORIZED', 'PENDING_PAYMENT'].includes(h.status)) await this.letGo(h.id, b.id, by, note)
    }
  }

  private async letGo(holdId: string, bookingId: string, by: string, note: string) {
    try {
      await this.escrow.releaseHold(holdId, by, note)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await this.escrow.recordFailure({ holdId, bookingId, action: 'void', amount: null, message })
    }
  }

  // ── Failed collections ────────────────────────────────────────────────────

  /**
   * Tries a failed collection or release again. A collection that now goes
   * through is added to what the booking was charged.
   */
  async retryFailure(id: number, by: string) {
    const f = await this.escrow.failure(id)
    if (!f.holdId) throw apiError(409, 'ERR_INVALID_STATE', 'This failure has no card hold to retry.')
    try {
      if (f.action === 'capture') {
        const hold = await this.escrow.captureNoShow(f.holdId, by, 'No-show penalty collected on retry')
        if (f.bookingId) await this.addCharge(f.bookingId, hold.amount, id)
      } else {
        await this.escrow.releaseHold(f.holdId, by, 'Released on retry')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await this.escrow.failedAgain(id, message)
      throw apiError(502, 'ERR_GATEWAY', `Still failing: ${message}`)
    }
    await this.escrow.resolveFailure(id, by, 'RETRIED')
    return { id, resolved: true }
  }

  /** The booking's penalty is complete once no collection for it is still failing. */
  private async addCharge(bookingId: string, amount: number, resolvedFailureId: number) {
    const b = await this.find(bookingId)
    if (!b) return
    const stillFailing = (await this.escrow.openFailures()).some((x) => x.bookingId === bookingId && x.action === 'capture' && x.id !== resolvedFailureId)
    await this.db
      .update(bookings)
      .set({ penaltyChargedPkr: round((b.penaltyChargedPkr ?? 0) + amount), penaltyStatus: stillFailing ? 'FAILED' : 'CHARGED', updatedAt: new Date().toISOString() })
      .where(eq(bookings.id, bookingId))
  }
}
