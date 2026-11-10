import { Controller, Delete, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common'
import { rawError } from '../../common/errors'
import { num, Query } from '../../common/http'
import { AdminGuard } from '../access/admin.guard'

/**
 * Screens whose records are created by the Mingler app: Minglers, their
 * bookings and their reviews, and the per-booking finance rows.
 *
 * Nothing writes these yet (the Mingler app is not built), so every list is
 * empty and every record is "not found", with the same validation and
 * envelopes the screens were built against. When the Mingler app API lands,
 * each controller here gets its table and these routes read from it; the
 * response shapes below are the contract to keep.
 */

const fail = (status: number, code: string, message: string, details: unknown = {}) =>
  rawError(status, { success: false, error: { code, message, details } })
const minglerNotFound = () => fail(404, 'ERR_MINGLER_NOT_FOUND', 'Mingler not found.')
const emptyPage = (page: number, pageSize: number, totalKey: 'totalItems' | 'totalRecords') => ({
  items: [],
  pagination: { page, pageSize, [totalKey]: 0, totalPages: 1 },
})

/** Minglers: /admin/api/v1/minglers */
@Controller('admin/api/v1/minglers')
@UseGuards(AdminGuard)
export class MinglersController {
  @Get()
  list(@Query() q: Record<string, string>) {
    return { success: true, data: emptyPage(num(q.page, 1), num(q.pageSize, 25), 'totalItems') }
  }

  /** Pro Minglers who can host an interest table. */
  @Get('prominglers/active')
  prominglers() {
    return { success: true, data: { items: [] } }
  }

  @Get(':id')
  one() {
    throw rawError(404, { message: 'Not found' })
  }

  @Get(':id/bookings')
  bookings() {
    return []
  }

  @Get(':id/bookings/count-active')
  activeBookings() {
    throw minglerNotFound()
  }

  @Post(':id/suspend')
  @HttpCode(200)
  suspend() {
    throw minglerNotFound()
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  reactivate() {
    throw minglerNotFound()
  }

  @Patch(':id/promingler')
  promingler() {
    throw minglerNotFound()
  }

  @Get(':id/eating-preferences')
  eatingPreferences() {
    throw minglerNotFound()
  }

  @Get(':id/payment-methods')
  paymentMethods() {
    throw minglerNotFound()
  }

  @Post(':id/payment-methods/:pmId/set-default')
  @HttpCode(200)
  setDefaultPaymentMethod() {
    throw fail(404, 'ERR_PAYMENT_METHOD_NOT_FOUND', 'Payment method not found.')
  }
}

/** Reviews: /admin/api/v1/{restaurants/:rid/reviews, admin/reviews, reviews/:id} */
@Controller('admin/api/v1')
@UseGuards(AdminGuard)
export class ReviewsController {
  /** A restaurant's reviews with the rating summary. */
  @Get('restaurants/:rid/reviews')
  ofRestaurant(@Query() q: Record<string, string>) {
    const summary = { average: 0, total: 0, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }, positive: 0, neutral: 0, negative: 0 }
    return { success: true, data: { summary, ...emptyPage(num(q.page, 1), num(q.pageSize, 10), 'totalRecords') } }
  }

  /** A Mingler's reviews. */
  @Get('admin/reviews')
  ofMingler(@Query() q: Record<string, string>) {
    return { success: true, data: emptyPage(num(q.page, 1), num(q.pageSize, 10), 'totalRecords') }
  }

  @Get('reviews/:id')
  one() {
    throw fail(404, 'ERR_REVIEW_NOT_FOUND', 'Review not found.')
  }

  @Delete('reviews/:id')
  remove() {
    throw fail(404, 'ERR_REVIEW_NOT_FOUND', 'Review not found.')
  }
}

/** Per-booking finance rows: /admin/api/v1/admin/finances */
@Controller('admin/api/v1/admin/finances')
@UseGuards(AdminGuard)
export class FinancesController {
  @Get()
  list(@Query() q: Record<string, string>) {
    if (q.dateFrom && q.dateTo && q.dateFrom > q.dateTo) throw rawError(400, { error: { message: 'Invalid date range.' } })
    return { success: true, data: emptyPage(num(q.page, 1), num(q.pageSize, 25), 'totalRecords') }
  }

  /** TODO(go-live, GM-247): generate the CSV and return a real signed link; this address is the contract's sample. */
  @Get('export')
  export() {
    return {
      success: true,
      data: { url: 'https://s3.amazonaws.com/admin-exports/finances-exports/finances-16-06-2026-1430.csv', expiresIn: 300 },
    }
  }

  @Get(':bookingId')
  one() {
    throw rawError(404, { success: false, error: { message: 'Booking not found' } })
  }
}

/** Screens with nothing behind them yet: /admin/api/timer-settings */
@Controller('admin/api')
@UseGuards(AdminGuard)
export class TimerSettingsController {
  @Get('timer-settings')
  timerSettings() {
    return []
  }
}
