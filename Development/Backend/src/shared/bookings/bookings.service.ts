import crypto from 'node:crypto'
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { bookings, interestTables, restaurants } from '../../db/schema'
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
 *   booking made ──► card hold for penalty × seats (none when the penalty is 0)
 *        │
 *        ├─ guests arrived ─► hold let go, nothing charged
 *        ├─ no-show (some or all seats) ─► penalty × empty seats collected into
 *        │                                 escrow, the rest of the hold let go
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
    if (process.env.NODE_ENV === 'test') return
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
  async book(input: { interestTableId: string; minglerName: string; seats: unknown; menuOption?: string; by: string }) {
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
    const penalty = restaurant?.noShowPenaltyPerSeatPkr ?? 0
    const id = `bk-${crypto.randomBytes(4).toString('hex')}`
    const bookingRef = newBookingRef()
    const now = new Date().toISOString()
    // The card hold comes first: no hold, no booking.
    const hold =
      penalty > 0
        ? await this.escrow.createHold({
            restaurantId: table.restaurantId,
            minglerName: input.minglerName,
            guests: seats,
            amountPerGuest: penalty,
            eventName: table.name ?? 'Interest Table',
            eventAt: new Date(startsAt(table)).toISOString(),
            by: input.by,
            kind: 'NO_SHOW_HOLD',
            bookingId: id,
            bookingRef,
          })
        : null
    const [booking] = await this.db
      .insert(bookings)
      .values({
        id,
        bookingRef,
        interestTableId: table.id,
        restaurantId: table.restaurantId,
        minglerName: input.minglerName,
        seats,
        menuOption: input.menuOption ?? '',
        status: 'CONFIRMED',
        penaltyPerSeatPkr: penalty,
        cancellationWindowHours: restaurant?.cancellationWindowHours ?? 24,
        escrowHoldId: hold?.id ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    await this.db.update(interestTables).set({ seatsBooked: sql`${interestTables.seatsBooked} + ${seats}` }).where(eq(interestTables.id, table.id))
    return { booking, hold }
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

    let charged = 0
    let penaltyStatus: string | null = null
    if (due > 0 && claimed.escrowHoldId) {
      try {
        await this.escrow.captureNoShow(
          claimed.escrowHoldId,
          due,
          by,
          `No-show penalty: ${emptySeats} empty seat${emptySeats === 1 ? '' : 's'} × ${fmtPkr(b.penaltyPerSeatPkr)}`,
        )
        charged = due
        penaltyStatus = 'CHARGED'
      } catch (err) {
        // Never silent: the booking shows the failure and it is queued for a person.
        penaltyStatus = 'FAILED'
        const message = err instanceof Error ? err.message : String(err)
        await this.escrow.recordFailure({ holdId: claimed.escrowHoldId, bookingId: b.id, action: 'capture', amount: due, message })
        await this.notifications.notifyAdmins({
          type: 'PAYMENT_FAILED',
          title: 'No-show penalty could not be collected',
          body: `${fmtPkr(due)} for booking ${b.bookingRef} was not collected: ${message}`,
          deepLink: '/finances/escrow',
          metadata: { bookingId: b.id, escrowId: claimed.escrowHoldId },
        })
      }
    }
    const [updated] = await this.db
      .update(bookings)
      .set({ penaltyChargedPkr: charged, penaltyStatus })
      .where(eq(bookings.id, b.id))
      .returning()

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

  private async letHoldGo(b: Booking, by: string, note: string) {
    if (!b.escrowHoldId) return
    try {
      await this.escrow.releaseHold(b.escrowHoldId, by, note)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await this.escrow.recordFailure({ holdId: b.escrowHoldId, bookingId: b.id, action: 'void', amount: null, message })
    }
  }
}
