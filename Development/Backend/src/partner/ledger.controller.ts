import { Controller, Get, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { apiError } from '../common/errors'
import { Query } from '../common/http'
import { PartnerGuard } from './access/partner.guard'
import { profileError } from './profile/profile.service'

/**
 * Reviews and the finance ledger of a restaurant. Both are written by the
 * Mingler app (a review after a dinner, a transaction per paid booking), which
 * is not built yet: the lists are empty and every record is "not found", with
 * the validation the screens rely on. See admin/minglers/mingler-data.controller.ts.
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

/** Finance ledger: /partner/api/v1/partner/finances */
@Controller('partner/api/v1/partner/finances')
@UseGuards(PartnerGuard)
export class PartnerFinancesController {
  @Get()
  list(@Query() q: Record<string, string>) {
    validateFilters(q)
    if (q.page !== undefined && (!Number.isInteger(Number(q.page)) || Number(q.page) < 1)) throw invalid('Invalid page.')
    if (q.pageSize !== undefined && ![10, 25, 50].includes(Number(q.pageSize))) throw invalid('Invalid page size.')
    const pageSize = q.pageSize ? Number(q.pageSize) : 10
    return { success: true, data: { items: [], pagination: { page: 1, pageSize, totalRecords: 0, totalPages: 1 } } }
  }

  /** The whole filtered ledger as CSV. */
  @Get('export')
  export(@Query() q: Record<string, string>, @Res() res: Response) {
    if (q.page || q.pageSize) throw invalid('Pagination is not supported on export.')
    validateFilters(q)
    const k = new Date(Date.now() + 5 * 3_600_000).toISOString()
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="finances-${k.slice(0, 10)}-${k.slice(11, 13)}${k.slice(14, 16)}.csv"`)
    res.status(200).end('Booking ID,Mingler,Interest Table,Date,Total Amount (PKR),My Share (PKR)\n')
  }

  @Get(':bookingId')
  one() {
    throw apiError(404, 'ERR_NOT_FOUND', 'Transaction not found.', null)
  }
}
