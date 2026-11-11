import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { apiError } from '../common/errors'
import { Query } from '../common/http'
import { csvCell, FinanceLedgerService, type LedgerRow } from '../shared/payments/finance-ledger.service'
import { CurrentPartner, PartnerGuard } from './access/partner.guard'
import type { PartnerUser } from './access/partner-accounts.service'
import { profileError } from './profile/profile.service'

/**
 * Reviews and the finance ledger of a restaurant.
 *
 * Reviews are written by the Mingler app, which is not built yet: the list is
 * empty and every record is "not found". The finance ledger is real: it reads
 * the money collected for the restaurant's bookings from the escrow ledger.
 */

const clampSize = (raw: string | undefined) => ([10, 25, 50].includes(Number(raw)) ? Number(raw) : 10)

/** Reviews: /partner/api/v1/partner/reviews. Never refuses a query: bad values fall back. */
@Controller('partner/api/v1/partner/reviews')
@UseGuards(PartnerGuard)
export class PartnerReviewsController {
  @Get()
  list(@Query() q: Record<string, string>) {
    return {
      success: true,
      data: {
        summary: { average: 0, total: 0, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } },
        items: [],
        pagination: { page: 1, pageSize: clampSize(q.pageSize), totalRecords: 0, totalPages: 1 },
      },
    }
  }

  @Get(':reviewId')
  one() {
    throw profileError('ERR_NOT_FOUND', 'Review not found.', 404)
  }
}

const invalid = (message: string) => apiError(422, 'ERR_VALIDATION', message, null)
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const BAD_RANGE = 'Invalid date range.'

/** The restaurant comes from the session, never from the request. */
function validateFilters(q: Record<string, string>) {
  if (q.restaurantId) throw invalid('Unexpected parameter.')
  if (q.sortBy && !['bookingRef', 'mingler', 'interestTable', 'date'].includes(q.sortBy)) throw invalid('Invalid sort field.')
  if (q.sortOrder && !['asc', 'desc'].includes(q.sortOrder)) throw invalid('Invalid sort order.')
  if (q.searchField && !['bookingRef', 'mingler', 'interestTable'].includes(q.searchField)) throw invalid('Invalid search field.')
  if (q.period && !['ALL_TIME', 'THIS_MONTH', 'THIS_YEAR', 'CUSTOM'].includes(q.period)) throw invalid('Invalid period.')
  const { dateFrom, dateTo, period } = q
  if (period && period !== 'CUSTOM' && (dateFrom || dateTo)) throw invalid(BAD_RANGE)
  if (period === 'CUSTOM' && (!dateFrom || !dateTo)) throw invalid(BAD_RANGE)
  if (dateFrom && !ISO_DATE.test(dateFrom)) throw invalid(BAD_RANGE)
  if (dateTo && !ISO_DATE.test(dateTo)) throw invalid(BAD_RANGE)
  if (dateFrom && dateTo && dateFrom > dateTo) throw invalid(BAD_RANGE)
}

/** Finance ledger: /partner/api/v1/partner/finances. One row per booking money was collected for. */
@Controller('partner/api/v1/partner/finances')
@UseGuards(PartnerGuard)
export class PartnerFinancesController {
  constructor(private readonly ledger: FinanceLedgerService) {}

  private async rows(user: PartnerUser, q: Record<string, string>): Promise<LedgerRow[]> {
    validateFilters(q)
    const today = new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10)
    const from = q.period === 'THIS_MONTH' ? `${today.slice(0, 7)}-01` : q.period === 'THIS_YEAR' ? `${today.slice(0, 4)}-01-01` : q.dateFrom
    const to = q.period === 'THIS_MONTH' ? `${today.slice(0, 7)}-31` : q.period === 'THIS_YEAR' ? `${today.slice(0, 4)}-12-31` : q.dateTo
    const term = (q.search ?? '').trim().toLowerCase()
    const field: Record<string, (r: LedgerRow) => string> = {
      bookingRef: (r) => r.bookingRef,
      mingler: (r) => r.minglerName,
      interestTable: (r) => r.interestTableName,
    }
    const searched = q.searchField ? field[q.searchField] : undefined
    const out = (await this.ledger.rows(user.restaurantId)).filter(
      (r) => (!from || r.date >= from) && (!to || r.date <= to) && (!term || !searched || searched(r).toLowerCase().includes(term)),
    )
    const pick = q.sortBy && q.sortBy !== 'date' ? field[q.sortBy] : undefined
    const dir = q.sortOrder === 'asc' ? 1 : -1
    if (pick) return [...out].sort((a, b) => (pick(a).toLowerCase() < pick(b).toLowerCase() ? -dir : pick(a).toLowerCase() > pick(b).toLowerCase() ? dir : 0))
    // By event date, then start time; newest first unless asked otherwise.
    return q.sortOrder === 'asc' ? [...out].reverse() : out
  }

  @Get()
  async list(@CurrentPartner() user: PartnerUser, @Query() q: Record<string, string>) {
    if (q.page !== undefined && (!Number.isInteger(Number(q.page)) || Number(q.page) < 1)) throw invalid('Invalid page.')
    if (q.pageSize !== undefined && ![10, 25, 50].includes(Number(q.pageSize))) throw invalid('Invalid page size.')
    const rows = await this.rows(user, q)
    const pageSize = q.pageSize ? Number(q.pageSize) : 10
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
    // A page past the end shows the last one.
    const page = Math.min(q.page ? Number(q.page) : 1, totalPages)
    return {
      success: true,
      data: {
        items: rows.slice((page - 1) * pageSize, page * pageSize).map((r) => ({
          bookingId: r.bookingId,
          bookingRef: r.bookingRef,
          mingler: { id: '', name: r.minglerName },
          interestTable: { id: r.interestTableId, name: r.interestTableName },
          date: r.date,
          totalAmountPkr: r.totalPkr,
          mySharePkr: r.partnerSharePkr,
        })),
        pagination: { page, pageSize, totalRecords: rows.length, totalPages },
      },
    }
  }

  /** The whole filtered ledger as CSV. */
  @Get('export')
  async export(@CurrentPartner() user: PartnerUser, @Query() q: Record<string, string>, @Res() res: Response) {
    if (q.page || q.pageSize) throw invalid('Pagination is not supported on export.')
    const rows = await this.rows(user, q)
    const k = new Date(Date.now() + 5 * 3_600_000).toISOString()
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="finances-${k.slice(0, 10)}-${k.slice(11, 13)}${k.slice(14, 16)}.csv"`)
    const lines = [
      'Booking ID,Mingler,Interest Table,Date,Total Amount (PKR),My Share (PKR)',
      ...rows.map((r) => [r.bookingRef, r.minglerName, r.interestTableName, r.date, r.totalPkr, r.partnerSharePkr].map(csvCell).join(',')),
    ]
    res.status(200).end(`${lines.join('\n')}\n`)
  }

  @Get(':bookingId')
  async one(@CurrentPartner() user: PartnerUser, @Param('bookingId') bookingId: string) {
    const r = await this.ledger.one(bookingId, user.restaurantId)
    if (!r) throw apiError(404, 'ERR_NOT_FOUND', 'Transaction not found.', null)
    return {
      success: true,
      data: {
        bookingRef: r.bookingRef,
        restaurantName: r.restaurantName,
        mingler: { id: '', name: r.minglerName },
        date: r.date,
        mySharePkr: r.partnerSharePkr,
        gomingleSharePkr: r.gomingleSharePkr,
        // Loyalty points arrive with the Mingler app.
        loyaltyDeductionPkr: 0,
        loyaltyDeductionPoints: 0,
        totalAmountPkr: r.totalPkr,
        billPkr: r.billPkr,
        penaltyPkr: r.penaltyPkr,
        paidOut: r.paidOut,
      },
    }
  }
}
