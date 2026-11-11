import { Inject, Injectable } from '@nestjs/common'
import { inArray } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { bookings, escrowHolds, interestTables, restaurants } from '../../db/schema'
import { to12h } from '../interest-tables/interest-tables.service'

const round = (n: number) => Math.round(n * 100) / 100
const KARACHI_MS = 5 * 3_600_000
/** `2026-11-11T14:30` in Karachi time, from an instant. */
const karachi = (ms: number) => new Date(ms + KARACHI_MS).toISOString().slice(0, 16)

/** One line of the Finances ledger: everything GoMingle collected for one booking. */
export interface LedgerRow {
  /** The booking's id; for a stand-alone sandbox payment, the escrow entry's id. */
  bookingId: string
  bookingRef: string
  restaurantId: string
  restaurantName: string
  city: string | null
  address: string | null
  lat: number | null
  lng: number | null
  minglerName: string
  interestTableId: string
  interestTableName: string
  /** Event date in Karachi, YYYY-MM-DD. */
  date: string
  eventStart: string
  eventEnd: string
  /** For sorting: the event's start instant. */
  eventAt: number
  /** The dinner bill (seat price × seats that arrived). */
  billPkr: number
  /** No-show penalties collected for empty seats. */
  penaltyPkr: number
  totalPkr: number
  gomingleSharePkr: number
  partnerSharePkr: number
  /** True once every part of the total has been paid out to the restaurant. */
  paidOut: boolean
}

/**
 * The Finances ledger of both portals, read from the escrow ledger.
 *
 * A booking appears once money for it has actually been collected: its dinner
 * bill at check-in, a no-show penalty for empty seats, or both. Card holds
 * that were let go, and payments that were refunded, are not earnings and do
 * not appear. The split uses the platform fee in force when the money was taken.
 */
@Injectable()
export class FinanceLedgerService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async rows(restaurantId?: string): Promise<LedgerRow[]> {
    const holds = (await this.db.select().from(escrowHolds).where(inArray(escrowHolds.status, ['IN_ESCROW', 'RELEASED']))).filter(
      (h) => !restaurantId || h.restaurantId === restaurantId,
    )
    if (holds.length === 0) return []
    const bookingIds = [...new Set(holds.map((h) => h.bookingId).filter((x): x is string => Boolean(x)))]
    const bookingRows = bookingIds.length ? await this.db.select().from(bookings).where(inArray(bookings.id, bookingIds)) : []
    const bookingOf = new Map(bookingRows.map((b) => [b.id, b]))
    const tableIds = [...new Set(bookingRows.map((b) => b.interestTableId))]
    const tableRows = tableIds.length ? await this.db.select().from(interestTables).where(inArray(interestTables.id, tableIds)) : []
    const tableOf = new Map(tableRows.map((t) => [t.id, t]))
    const restaurantRows = await this.db.select().from(restaurants).where(inArray(restaurants.id, [...new Set(holds.map((h) => h.restaurantId))]))
    const restaurantOf = new Map(restaurantRows.map((r) => [r.id, r]))

    const byBooking = new Map<string, typeof holds>()
    for (const h of holds) {
      const key = h.bookingId ?? h.id
      byBooking.set(key, [...(byBooking.get(key) ?? []), h])
    }
    const out: LedgerRow[] = []
    for (const [key, group] of byBooking) {
      const first = group[0]
      const booking = bookingOf.get(key)
      const table = booking ? tableOf.get(booking.interestTableId) : undefined
      const restaurant = restaurantOf.get(first.restaurantId)
      const eventAt = Date.parse(first.eventAt)
      const start = karachi(eventAt)
      const end = karachi(eventAt + (table?.durationMinutes ?? 0) * 60_000)
      const sum = (rows: typeof holds) => round(rows.reduce((t, h) => t + h.amount, 0))
      const fee = round(group.reduce((t, h) => t + round((h.amount * h.platformFeePct) / 100), 0))
      const total = sum(group)
      const penalty = sum(group.filter((h) => h.kind === 'NO_SHOW_HOLD'))
      out.push({
        bookingId: key,
        bookingRef: first.bookingRef,
        restaurantId: first.restaurantId,
        restaurantName: restaurant?.name ?? first.restaurantId,
        city: restaurant?.city ?? null,
        address: restaurant?.fullAddress ?? null,
        lat: restaurant?.latitude ?? null,
        lng: restaurant?.longitude ?? null,
        minglerName: first.minglerName,
        interestTableId: booking?.interestTableId ?? '',
        interestTableName: table?.name ?? first.eventName,
        date: start.slice(0, 10),
        eventStart: to12h(start.slice(11)),
        eventEnd: to12h(end.slice(11)),
        eventAt,
        billPkr: round(total - penalty),
        penaltyPkr: penalty,
        totalPkr: total,
        gomingleSharePkr: fee,
        partnerSharePkr: round(total - fee),
        paidOut: group.every((h) => h.status === 'RELEASED'),
      })
    }
    return out.sort((a, b) => b.eventAt - a.eventAt || (a.bookingRef < b.bookingRef ? 1 : -1))
  }

  /** By booking id, escrow id or booking reference. */
  async one(idOrRef: string, restaurantId?: string): Promise<LedgerRow | null> {
    return (await this.rows(restaurantId)).find((r) => r.bookingId === idOrRef || r.bookingRef === idOrRef) ?? null
  }
}

/** A CSV cell: quoted when it needs to be, and never read as a formula by a spreadsheet. */
export function csvCell(value: string | number): string {
  const text = typeof value === 'number' ? String(value) : /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
