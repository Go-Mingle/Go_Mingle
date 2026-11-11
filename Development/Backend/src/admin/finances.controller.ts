import crypto from 'node:crypto'
import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { config } from '../config'
import { rawError } from '../common/errors'
import { num, Query } from '../common/http'
import { csvCell, FinanceLedgerService, type LedgerRow } from '../shared/payments/finance-ledger.service'
import { AdminGuard } from './access/admin.guard'

const EXPORT_TTL_SECONDS = 300
const FILTERS = ['bookingRef', 'restaurant', 'mingler', 'interestTable', 'dateFrom', 'dateTo', 'sortBy', 'sortOrder'] as const
type Filters = Partial<Record<(typeof FILTERS)[number], string>>

/** The list shows dates as DD-MM-YYYY. */
const dmy = (iso: string) => iso.split('-').reverse().join('-')
const contains = (value: string, term?: string) => !term || value.toLowerCase().includes(term.trim().toLowerCase().slice(0, 100))

function filtered(rows: LedgerRow[], q: Filters): LedgerRow[] {
  const out = rows.filter(
    (r) =>
      contains(r.bookingRef, q.bookingRef) &&
      contains(r.restaurantName, q.restaurant) &&
      contains(r.minglerName, q.mingler) &&
      contains(r.interestTableName, q.interestTable) &&
      (!q.dateFrom || r.date >= q.dateFrom) &&
      (!q.dateTo || r.date <= q.dateTo),
  )
  const key: Record<string, (r: LedgerRow) => string | number> = {
    bookingRef: (r) => r.bookingRef,
    restaurant: (r) => r.restaurantName.toLowerCase(),
    mingler: (r) => r.minglerName.toLowerCase(),
    interestTable: (r) => r.interestTableName.toLowerCase(),
    date: (r) => r.eventAt,
    total: (r) => r.totalPkr,
  }
  const pick = q.sortBy ? key[q.sortBy] : undefined
  if (!pick) return out // newest event first
  const dir = q.sortOrder === 'asc' ? 1 : -1
  return [...out].sort((a, b) => (pick(a) < pick(b) ? -dir : pick(a) > pick(b) ? dir : 0))
}

const sign = (payload: string) => crypto.createHmac('sha256', config.jwtSecret).update(`finances-export:${payload}`).digest('base64url')

/**
 * Finances: one row per booking GoMingle collected money for, with the split
 * between the restaurant and GoMingle. /admin/api/v1/admin/finances
 */
@Controller('admin/api/v1/admin/finances')
export class FinancesController {
  constructor(private readonly ledger: FinanceLedgerService) {}

  @Get()
  @UseGuards(AdminGuard)
  async list(@Query() q: Record<string, string>) {
    if (q.dateFrom && q.dateTo && q.dateFrom > q.dateTo) throw rawError(400, { error: { message: 'Invalid date range.' } })
    const rows = filtered(await this.ledger.rows(), q)
    const page = Math.max(1, num(q.page, 1))
    const pageSize = Math.max(1, num(q.pageSize, 25))
    return {
      success: true,
      data: {
        items: rows.slice((page - 1) * pageSize, page * pageSize).map((r) => ({
          bookingRef: r.bookingRef,
          restaurant: { id: r.restaurantId, name: r.restaurantName, city: r.city, address: r.address, lat: r.lat, lng: r.lng, avatarUrl: null },
          // Minglers get accounts with the Mingler app; until then there is only the name on the booking.
          mingler: { id: '', name: r.minglerName },
          interestTableName: r.interestTableName,
          date: dmy(r.date),
          eventStart: r.eventStart,
          eventEnd: r.eventEnd,
          totalAmountPkr: r.totalPkr,
          partnerSharePkr: r.partnerSharePkr,
          gomingleSharePkr: r.gomingleSharePkr,
          billPkr: r.billPkr,
          penaltyPkr: r.penaltyPkr,
          paidOut: r.paidOut,
        })),
        pagination: { page, pageSize, totalRecords: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / pageSize)) },
      },
    }
  }

  /**
   * A link to the CSV of the filtered ledger, good for five minutes. The link
   * carries its own signature, so the browser can download it directly.
   */
  @Get('export')
  @UseGuards(AdminGuard)
  export(@Query() q: Record<string, string>) {
    const filters: Filters = {}
    for (const k of FILTERS) if (q[k]) filters[k] = q[k]
    const payload = Buffer.from(JSON.stringify({ f: filters, exp: Math.floor(Date.now() / 1000) + EXPORT_TTL_SECONDS })).toString('base64url')
    const k = new Date(Date.now() + 5 * 3_600_000).toISOString()
    const file = `finances-${dmy(k.slice(0, 10))}-${k.slice(11, 13)}${k.slice(14, 16)}.csv`
    return {
      success: true,
      data: { url: `${config.publicUrl}/admin/api/v1/admin/finances/export/${file}?token=${payload}.${sign(payload)}`, expiresIn: EXPORT_TTL_SECONDS },
    }
  }

  /** The CSV itself. Opened by the signed link above, so it takes no session. */
  @Get('export/:file')
  async exportFile(@Param('file') file: string, @Query() q: Record<string, string>, @Res() res: Response) {
    const [payload, signature] = String(q.token ?? '').split('.')
    const expected = payload ? sign(payload) : ''
    const valid = Boolean(signature) && signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    let parsed: { f: Filters; exp: number } | null = null
    try {
      parsed = valid ? JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) : null
    } catch {
      parsed = null
    }
    if (!parsed || parsed.exp < Date.now() / 1000) throw rawError(403, { success: false, error: { message: 'This export link has expired. Export again.' } })
    const rows = filtered(await this.ledger.rows(), parsed.f)
    const lines = [
      'Restaurant,Booking ID,Interest Table,Mingler,Total (PKR),Partner Share (PKR),GoMingle Share (PKR),Date',
      ...rows.map((r) => [r.restaurantName, r.bookingRef, r.interestTableName, r.minglerName, r.totalPkr, r.partnerSharePkr, r.gomingleSharePkr, dmy(r.date)].map(csvCell).join(',')),
    ]
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${file.replace(/[^\w.-]/g, '')}"`)
    res.status(200).end(`${lines.join('\n')}\n`)
  }

  @Get(':bookingId')
  @UseGuards(AdminGuard)
  async one(@Param('bookingId') bookingId: string) {
    const r = await this.ledger.one(bookingId)
    if (!r) throw rawError(404, { success: false, error: { message: 'Booking not found' } })
    return {
      success: true,
      data: {
        bookingRef: r.bookingRef,
        restaurant: r.restaurantName,
        mingler: r.minglerName,
        interestTableName: r.interestTableName,
        date: dmy(r.date),
        eventStart: r.eventStart,
        eventEnd: r.eventEnd,
        partnerSharePkr: r.partnerSharePkr,
        gomingleSharePkr: r.gomingleSharePkr,
        // Loyalty points arrive with the Mingler app.
        loyaltyRedeemedPkr: 0,
        loyaltyRedeemedPoints: 0,
        totalAmountPkr: r.totalPkr,
        billPkr: r.billPkr,
        penaltyPkr: r.penaltyPkr,
        paidOut: r.paidOut,
      },
    }
  }
}
