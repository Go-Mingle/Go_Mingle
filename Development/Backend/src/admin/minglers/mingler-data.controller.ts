import { Controller, Delete, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common'
import { rawError } from '../../common/errors'
import { num, Query } from '../../common/http'
import { AdminGuard } from '../access/admin.guard'
import { config } from '../../config'
import { CHECK_IN_OPENS_MINUTES, NO_SHOW_GRACE_MINUTES } from '../../shared/bookings/bookings.service'

/**
 * Screens whose records are created by the Mingler app: Minglers, their
 * bookings and their reviews.
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

/**
 * Timer Settings (GM-342): every timer the platform runs, with its value and
 * where it applies. The booking windows are platform-fixed in the requirements
 * (SA6, Mingler stories AC13-AC15), so this screen shows them rather than
 * offering to change them; each restaurant's own cancellation window and
 * no-show penalty are set on its No-show policy.
 */
@Controller('admin/api')
@UseGuards(AdminGuard)
export class TimerSettingsController {
  @Get('timer-settings')
  timerSettings() {
    const hours = (s: number) => Math.round(s / 3600)
    const t = (key: string, group: string, name: string, value: number, unit: 'minutes' | 'hours' | 'days', appliesTo: string, source: 'PLATFORM_FIXED' | 'PER_RESTAURANT') => ({
      key,
      group,
      name,
      value,
      unit,
      appliesTo,
      source,
    })
    return [
      t('confirm-window', 'Bookings', 'Auto-confirm window', 24, 'hours', 'A table with at least 4 seats booked confirms this long before it starts, and cards are charged.', 'PLATFORM_FIXED'),
      t('auto-cancel', 'Bookings', 'Auto-cancel check', 4, 'hours', 'A Pending table still under 4 seats is cancelled this long before it starts; holds are released.', 'PLATFORM_FIXED'),
      t('booking-close', 'Bookings', 'Booking window closes', 2, 'hours', 'No new bookings this close to the start; seats are re-checked.', 'PLATFORM_FIXED'),
      t('check-in-opens', 'Check-in', 'Check-in opens', CHECK_IN_OPENS_MINUTES, 'minutes', 'Staff can mark guests as arrived from this long before the start.', 'PLATFORM_FIXED'),
      t('no-show-grace', 'Check-in', 'No-show grace period', NO_SHOW_GRACE_MINUTES, 'minutes', 'After the start, bookings not checked in by then are marked no-show automatically.', 'PLATFORM_FIXED'),
      t('cancellation-window', 'Bookings', "Restaurant's cancellation window", 24, 'hours', 'Default; each restaurant sets its own on its No-show policy (up to 168 hours).', 'PER_RESTAURANT'),
      t('reset-code', 'Sign-in', 'Password reset code', 10, 'minutes', 'How long an emailed reset code stays valid.', 'PLATFORM_FIXED'),
      t('lockout', 'Sign-in', 'Account lockout', config.lockout.lockMinutes, 'minutes', `After ${config.lockout.maxFailures} wrong passwords in a row, sign-in is blocked for this long.`, 'PLATFORM_FIXED'),
      t('session', 'Sign-in', 'Session length', hours(config.accessTokenTtlSeconds), 'hours', 'A sign-in renews itself silently within this time.', 'PLATFORM_FIXED'),
      t('remember', 'Sign-in', 'Stay signed in', Math.round(config.refreshTokenTtlSeconds / 86400), 'days', 'After this long without using the portal, people sign in again.', 'PLATFORM_FIXED'),
    ]
  }
}
