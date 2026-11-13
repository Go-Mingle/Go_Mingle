import { Controller, Get, HttpCode, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common'
import { rawError, apiError } from '../common/errors'
import { Body, num, Query } from '../common/http'
import { BookingsService, type Booking } from '../shared/bookings/bookings.service'
import { AuditInterceptor } from '../shared/changelog/audit.interceptor'
import { InterestTablesService, to12h, type InterestTable } from '../shared/interest-tables/interest-tables.service'
import { AdminGuard, CurrentAdmin } from './access/admin.guard'
import type { AdminSession } from './access/admin-accounts.service'

const notFound = () => rawError(404, { success: false, error: { code: 'ERR_BOOKING_NOT_FOUND', message: 'Booking not found.' } })

/**
 * Bookings in the Admin Panel: /admin/api/v1/admin/bookings
 * Lists are always scoped to a Mingler or an interest table.
 */
@Controller('admin/api/v1/admin/bookings')
@UseGuards(AdminGuard)
@UseInterceptors(AuditInterceptor)
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly tables: InterestTablesService,
  ) {}

  private row(b: Booking, t: InterestTable | null, restaurantName: string) {
    return {
      id: b.id,
      bookingRef: b.bookingRef,
      minglerId: b.minglerId ?? '',
      minglerName: b.minglerName,
      isCaptain: false,
      isCrownProMingler: false,
      isTickProMingler: false,
      prominglerLabel: null,
      interestTableId: b.interestTableId,
      interestTableName: t?.name ?? '',
      topic: t?.topic?.name ?? '',
      restaurantId: b.restaurantId,
      restaurantName,
      menuOption: b.menuOption,
      date: t?.startDate ?? '',
      time: to12h(t?.startTime),
      status: b.status,
      billPkr: b.billPkr,
      seatPricePkr: b.seatPricePkr,
      seats: b.seats,
      attendance: b.attendance,
      emptySeats: b.emptySeats,
      penaltyPerSeatPkr: b.penaltyPerSeatPkr,
      penaltyChargedPkr: b.penaltyChargedPkr,
      penaltyStatus: b.penaltyStatus,
    }
  }

  @Get()
  async list(@Query() q: Record<string, string>) {
    if (!q.minglerId && !q.interestTableId) {
      throw rawError(400, { success: false, error: { code: 'ERR_VALIDATION', message: 'A booking scope filter is required.', details: {} } })
    }
    const page = num(q.page, 1)
    const pageSize = num(q.pageSize, 10)
    const statuses = (q.status ?? '').split(',').filter(Boolean)
    // Bookings belong to Minglers once the Mingler app exists; until then only the table scope has rows.
    const table = q.interestTableId ? await this.tables.find(q.interestTableId) : null
    const names = await this.tables.restaurantNames()
    let items = table ? (await this.bookings.ofTable(table.id)).map((b) => this.row(b, table, names.get(b.restaurantId) ?? '')) : []
    if (statuses.length) items = items.filter((b) => statuses.includes(b.status))
    const key = (b: (typeof items)[number]) => (q.sortBy === 'status' ? b.status : q.sortBy === 'mingler' ? b.minglerName : q.sortBy === 'restaurant' ? b.restaurantName : b.date)
    items.sort((a, b) => {
      const cmp = key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0
      return q.sortOrder === 'asc' ? cmp : -cmp
    })
    const totalRecords = items.length
    const start = (page - 1) * pageSize
    return {
      success: true,
      data: { items: items.slice(start, start + pageSize), pagination: { page, pageSize, totalRecords, totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)) } },
    }
  }

  /**
   * A sandbox booking at an interest table, so check-in and no-show can be
   * tried before the Mingler app exists. Uses the restaurant's current no-show policy.
   */
  @Post('sandbox')
  @HttpCode(201)
  async sandbox(@Body() body: Record<string, unknown>, @CurrentAdmin() admin: AdminSession) {
    if (!body.interestTableId) throw apiError(422, 'ERR_VALIDATION', 'Choose an interest table.')
    const { booking, holds, heldTotalPkr } = await this.bookings.book({
      interestTableId: String(body.interestTableId),
      minglerName: String(body.minglerName ?? '').trim() || 'Test Mingler',
      minglerEmail: typeof body.minglerEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.minglerEmail.trim()) ? body.minglerEmail.trim() : null,
      seats: body.seats ?? 2,
      menuOption: typeof body.menuOption === 'string' ? body.menuOption : '',
      fallbackSeatPricePkr: typeof body.seatPricePkr === 'number' && Number.isFinite(body.seatPricePkr) && body.seatPricePkr <= 1_000_000 ? body.seatPricePkr : undefined,
      by: `${admin.fullName} (sandbox test booking)`,
    })
    const table = await this.tables.find(booking.interestTableId)
    const names = await this.tables.restaurantNames()
    // One card hold per seat (Safepay cannot collect part of a hold).
    return { success: true, data: { booking: this.row(booking, table, names.get(booking.restaurantId) ?? ''), holds, heldTotalPkr } }
  }

  /** Runs the automatic no-show check now (it also runs by itself every 15 minutes). */
  @Post('no-show-check')
  @HttpCode(200)
  async noShowCheck() {
    return { success: true, data: await this.bookings.runNoShowCheck() }
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const b = await this.bookings.find(id)
    if (!b) throw notFound()
    const table = await this.tables.find(b.interestTableId)
    const row = this.row(b, table, (await this.tables.restaurantNames()).get(b.restaurantId) ?? '')
    return {
      success: true,
      data: {
        id: row.id,
        bookingRef: row.bookingRef,
        interestTableName: row.interestTableName,
        topic: row.topic,
        restaurantName: row.restaurantName,
        date: row.date,
        time: row.time,
        menuOption: row.menuOption,
        isCrownProMingler: false,
        isTickProMingler: false,
        prominglerLabel: null,
        status: row.status,
        billPkr: row.billPkr,
        seats: row.seats,
        attendance: row.attendance,
        emptySeats: row.emptySeats,
        penaltyPerSeatPkr: row.penaltyPerSeatPkr,
        penaltyChargedPkr: row.penaltyChargedPkr,
      },
    }
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@Param('id') id: string, @CurrentAdmin() admin: AdminSession) {
    const b = await this.bookings.find(id)
    if (!b) throw notFound()
    const cancelled = await this.bookings.cancel(b, admin.fullName)
    if (!cancelled) {
      throw rawError(409, { success: false, error: { code: 'ERR_BOOKING_NOT_CANCELLABLE', message: 'This booking can no longer be cancelled.' } })
    }
    return { success: true, data: { id: b.id, status: 'CANCELLED' } }
  }
}
