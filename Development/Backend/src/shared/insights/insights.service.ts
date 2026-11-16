import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { bookings } from '../../db/schema'
import { startsAt } from '../bookings/bookings.service'
import { InterestTablesService, isUpcoming } from '../interest-tables/interest-tables.service'
import { EscrowService } from '../payments/escrow.service'

const DAY = 86_400_000
/** Pakistan is UTC+5 all year. */
const PKT = 5 * 3_600_000
const round = (n: number) => Math.round(n * 100) / 100

/** The Pakistan calendar day (YYYY-MM-DD) a moment falls on. */
const pkDay = (ms: number) => new Date(ms + PKT).toISOString().slice(0, 10)

export const INSIGHT_RANGES = [7, 30, 90] as const

/**
 * The figures behind both dashboards, computed from bookings, interest tables
 * and the escrow ledger. With a restaurant id it is that restaurant's view
 * (Partner Portal); without, the whole platform (Admin Panel).
 *
 * Everything is by Pakistan calendar day. Money: `collected` is what was taken
 * from Minglers' cards into escrow, `paidOut` what reached restaurants after
 * GoMingle's fee, `fees` that fee.
 */
@Injectable()
export class InsightsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly tables: InterestTablesService,
    private readonly escrow: EscrowService,
  ) {}

  async overview(opts: { restaurantId?: string; days?: number; now?: number } = {}) {
    const days = INSIGHT_RANGES.includes(opts.days as (typeof INSIGHT_RANGES)[number]) ? (opts.days as number) : 30
    const now = opts.now ?? Date.now()
    // The window ends with today and starts at midnight, Pakistan time, `days` days back.
    const startOfToday = Math.floor((now + PKT) / DAY) * DAY - PKT
    const from = startOfToday - (days - 1) * DAY
    const before = from - days * DAY

    const [allBookings, allTables, holds, names] = await Promise.all([
      opts.restaurantId ? this.db.select().from(bookings).where(eq(bookings.restaurantId, opts.restaurantId)) : this.db.select().from(bookings),
      opts.restaurantId ? this.tables.ofRestaurant(opts.restaurantId) : this.tables.all(),
      this.escrow.list({ restaurantId: opts.restaurantId }),
      this.tables.restaurantNames(),
    ])

    // ── Money events, each stamped with the moment it happened ──────────────
    const collected: { at: number; amount: number; restaurantId: string }[] = []
    const paid: { at: number; amount: number; fee: number; restaurantId: string }[] = []
    for (const h of holds) {
      const captured = h.timeline.find((e) => e.status === 'IN_ESCROW')
      if (captured) collected.push({ at: Date.parse(captured.at), amount: h.amount, restaurantId: h.restaurantId })
      if (h.status === 'RELEASED') {
        paid.push({ at: Date.parse(h.payout?.paidAt ?? h.updatedAt), amount: h.restaurantNet, fee: h.platformFee, restaurantId: h.restaurantId })
      }
    }
    const made = allBookings.map((b) => ({ at: Date.parse(b.createdAt), b }))

    const inWindow = <T extends { at: number }>(rows: T[], a = from, z = now) => rows.filter((r) => r.at >= a && r.at <= z)
    const total = <T>(rows: T[], pick: (r: T) => number) => round(rows.reduce((t, r) => t + pick(r), 0))
    const pair = <T extends { at: number }>(rows: T[], pick: (r: T) => number) => ({
      value: total(inWindow(rows), pick),
      previous: total(inWindow(rows, before, from - 1), pick),
    })

    // ── One row per day, empty days included ────────────────────────────────
    const daily = Array.from({ length: days }, (_, i) => ({ date: pkDay(from + i * DAY), bookings: 0, seats: 0, collectedPkr: 0, paidOutPkr: 0, feesPkr: 0 }))
    const dayOf = new Map(daily.map((d) => [d.date, d]))
    for (const { at, b } of inWindow(made)) {
      const d = dayOf.get(pkDay(at))
      if (d) {
        d.bookings += 1
        d.seats += b.seats
      }
    }
    for (const c of inWindow(collected)) {
      const d = dayOf.get(pkDay(c.at))
      if (d) d.collectedPkr = round(d.collectedPkr + c.amount)
    }
    for (const p of inWindow(paid)) {
      const d = dayOf.get(pkDay(p.at))
      if (d) {
        d.paidOutPkr = round(d.paidOutPkr + p.amount)
        d.feesPkr = round(d.feesPkr + p.fee)
      }
    }

    // ── How the period's bookings turned out ────────────────────────────────
    const outcome = { upcoming: 0, arrived: 0, partial: 0, noShow: 0, cancelled: 0 }
    for (const { b } of inWindow(made)) {
      if (b.status === 'CANCELLED') outcome.cancelled += 1
      else if (b.attendance === 'ARRIVED') outcome.arrived += 1
      else if (b.attendance === 'PARTIAL') outcome.partial += 1
      else if (b.attendance === 'NO_SHOW') outcome.noShow += 1
      else outcome.upcoming += 1
    }

    // ── Tables still to come, soonest first, with how full they are ─────────
    const seatsOf = new Map<string, number>()
    for (const b of allBookings) {
      if (b.status !== 'CANCELLED') seatsOf.set(b.interestTableId, (seatsOf.get(b.interestTableId) ?? 0) + b.seats)
    }
    const upcoming = allTables
      .filter((t) => isUpcoming(t) && t.status !== 'DRAFT' && t.startDate && t.startTime && startsAt(t) > now)
      .sort((a, b) => startsAt(a) - startsAt(b))
      .map((t) => ({
        id: t.id,
        name: t.name ?? '',
        restaurantId: t.restaurantId,
        restaurantName: names.get(t.restaurantId) ?? '',
        startsAt: new Date(startsAt(t)).toISOString(),
        maxGuests: t.maxGuests ?? 0,
        bookedSeats: Math.min(seatsOf.get(t.id) ?? 0, t.maxGuests ?? Number.MAX_SAFE_INTEGER),
      }))
    const capacity = upcoming.reduce((n, t) => n + t.maxGuests, 0)
    const booked = upcoming.reduce((n, t) => n + t.bookedSeats, 0)

    // ── Restaurants by what Minglers paid in the period (platform view) ─────
    const byRestaurant = new Map<string, { id: string; name: string; bookings: number; collectedPkr: number }>()
    const slot = (id: string) => {
      if (!byRestaurant.has(id)) byRestaurant.set(id, { id, name: names.get(id) ?? 'Restaurant', bookings: 0, collectedPkr: 0 })
      return byRestaurant.get(id)!
    }
    for (const { b } of inWindow(made)) slot(b.restaurantId).bookings += 1
    for (const c of inWindow(collected)) slot(c.restaurantId).collectedPkr = round(slot(c.restaurantId).collectedPkr + c.amount)

    const summary = await this.escrow.summary(opts.restaurantId)
    return {
      days,
      from: pkDay(from),
      to: pkDay(now),
      kpis: {
        bookings: pair(made, () => 1),
        seats: pair(made, (r) => r.b.seats),
        collectedPkr: pair(collected, (r) => r.amount),
        paidOutPkr: pair(paid, (r) => r.amount),
        feesPkr: pair(paid, (r) => r.fee),
        upcomingTables: upcoming.length,
        upcomingSeats: { booked, capacity },
      },
      daily,
      outcome,
      escrow: { heldPkr: summary.authorized, inEscrowPkr: summary.inEscrow, paidOutPkr: summary.released, refundedPkr: summary.refunded, feePct: summary.platformFeePct },
      upcoming: upcoming.slice(0, 6),
      topRestaurants: [...byRestaurant.values()].sort((a, b) => b.collectedPkr - a.collectedPkr || b.bookings - a.bookings).slice(0, 5),
    }
  }
}
