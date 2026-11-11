import { Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { Body, Query } from '../../common/http'
import { BookingsService, CHECK_IN_OPENS_MINUTES, startsAt, type Booking } from '../../shared/bookings/bookings.service'
import { karachiStamp } from '../../common/time'
import { InterestTablesService, to12h, type InterestTable } from '../../shared/interest-tables/interest-tables.service'
import { RestaurantsService } from '../../shared/restaurants/restaurants.service'
import { UsageService } from '../../shared/usage.service'
import { CurrentPartner, PartnerGuard } from '../access/partner.guard'
import type { PartnerUser } from '../access/partner-accounts.service'
import { profileError } from '../profile/profile.service'

const READ_ONLY_MESSAGE = "Your application is under review and can't be edited right now."
const tableNotFound = () => profileError('ERR_NOT_FOUND', 'Interest table not found.', 404)
const bookingNotFound = () => profileError('ERR_NOT_FOUND', 'Booking not found.', 404)
const inviteNotFound = () => profileError('ERR_NOT_FOUND', 'Invite not found.', 404)

/** The statuses the partner sees; anything else shows as Pending. */
const PARTNER_STATUS: Record<string, string> = {
  PENDING: 'PENDING',
  COMING_SOON: 'COMING_SOON',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
}

/**
 * Interest tables as the restaurant sees them (GoMingle manages them; drafts stay hidden):
 * /partner/api/v1/partner/{interest-tables,bookings,minglers}
 */
@Controller('partner/api/v1/partner')
@UseGuards(PartnerGuard)
export class PartnerInterestTablesController {
  constructor(
    private readonly tables: InterestTablesService,
    private readonly restaurants: RestaurantsService,
    private readonly usage: UsageService,
    private readonly bookings: BookingsService,
  ) {}

  private async view(t: InterestTable) {
    const [y, m, d] = String(t.startDate ?? '').split('-')
    const maxGuests = t.maxGuests ?? 8
    const pro = t.prominglerEnabled && t.prominglerMinglerId ? await this.usage.mingler(t.prominglerMinglerId) : null
    return {
      interestTableId: t.id,
      name: t.name,
      topic: t.topic?.name ?? '',
      assignedTable: t.assignedTable?.name ?? '',
      imageUrl: t.eventImageUrl,
      startDate: y && m && d ? `${d}-${m}-${y}` : String(t.startDate ?? ''),
      startTime: to12h(t.startTime),
      durationMinutes: t.durationMinutes ?? 120,
      minGuests: 4,
      maxGuests,
      seatsBooked: t.seatsBooked,
      seatsLeft: Math.max(0, maxGuests - t.seatsBooked),
      availabilityMode: t.availabilityMode ?? 'AVAILABLE_NOW',
      inviteOnly: t.inviteOnly,
      proMingler: t.prominglerEnabled ? { name: pro?.name ?? '', kind: 'ADMIN_ASSIGNED' } : { name: '', kind: 'NONE' },
      status: PARTNER_STATUS[t.status] ?? 'PENDING',
      createdAt: karachiStamp(new Date(t.created)),
      copyLinkEligible: t.status !== 'CANCELLED',
      // When staff can press "Guests Arrived" (one hour before the start time, while the table is still open).
      checkInOpensAt: new Date(startsAt(t) - CHECK_IN_OPENS_MINUTES * 60_000).toISOString(),
      canCheckIn: !['CANCELLED', 'COMPLETED'].includes(t.status) && t.seatsBooked > 0 && Date.now() >= startsAt(t) - CHECK_IN_OPENS_MINUTES * 60_000,
    }
  }

  private async live(user: PartnerUser): Promise<InterestTable[]> {
    return (await this.tables.ofRestaurant(user.restaurantId)).filter((t) => t.status !== 'DRAFT')
  }

  private async one(user: PartnerUser, itId: string): Promise<InterestTable> {
    const t = (await this.live(user)).find((x) => x.id === itId)
    if (!t) throw tableNotFound()
    return t
  }

  /** Cancelling is only for live restaurants. */
  private async requireActive(user: PartnerUser) {
    const r = await this.restaurants.ensure(user.restaurantId)
    if (r.status !== 'ACTIVE') throw profileError('ERR_PROFILE_READ_ONLY', READ_ONLY_MESSAGE, 409, { status: r.status })
  }

  @Get('interest-tables/:itId/menu-options')
  async menuOptions(@CurrentPartner() user: PartnerUser, @Param('itId') itId: string) {
    const t = await this.one(user, itId)
    const items = (await this.tables.menuOptionsOf(t)).map((o) => ({ name: o.name, pricePkr: o.pricePkr, courses: o.courses }))
    return { success: true, data: { items } }
  }

  /** One row of the Bookings tab. `cancellable` and `canMarkNoShow` are decided here, never by the screen. */
  private row(b: Booking, t: InterestTable, active: boolean) {
    const open = b.status === 'PENDING' || b.status === 'CONFIRMED'
    const [y, m, d] = String(t.startDate ?? '').split('-')
    return {
      bookingId: b.id,
      bookingRef: b.bookingRef,
      minglerId: b.minglerId ?? '',
      minglerName: b.minglerName,
      proMingler: { isProMingler: false, kind: 'NONE' },
      menuOption: b.menuOption,
      date: y && m && d ? `${d}-${m}-${y}` : String(t.startDate ?? ''),
      billPkr: b.billPkr,
      status: b.status,
      cancellable: open && active,
      seats: b.seats,
      attendance: b.attendance,
      arrivedSeats: b.arrivedSeats,
      emptySeats: b.emptySeats,
      penaltyPerSeatPkr: b.penaltyPerSeatPkr,
      penaltyChargedPkr: b.penaltyChargedPkr,
      penaltyStatus: b.penaltyStatus,
      canMarkNoShow: open && active && Date.now() >= startsAt(t),
    }
  }

  @Get('interest-tables/:itId/bookings')
  async listBookings(@CurrentPartner() user: PartnerUser, @Param('itId') itId: string) {
    const t = await this.one(user, itId)
    const active = (await this.restaurants.ensure(user.restaurantId)).status === 'ACTIVE'
    return { success: true, data: { items: (await this.bookings.ofTable(t.id)).map((b) => this.row(b, t, active)) } }
  }

  /** "Guests Arrived" (GM-38): checks in every open booking, lets the card holds go and completes the table. */
  @Post('interest-tables/:itId/guests-arrived')
  @HttpCode(200)
  async guestsArrived(@CurrentPartner() user: PartnerUser, @Param('itId') itId: string) {
    await this.requireActive(user)
    const t = await this.one(user, itId)
    return { success: true, data: await this.bookings.guestsArrived(t, user.fullName) }
  }

  /** A booking of this restaurant, with its (live) interest table. */
  private async myBooking(user: PartnerUser, bookingId: string): Promise<{ booking: Booking; table: InterestTable }> {
    const booking = await this.bookings.find(bookingId)
    if (!booking || booking.restaurantId !== user.restaurantId) throw bookingNotFound()
    const table = (await this.live(user)).find((x) => x.id === booking.interestTableId)
    if (!table) throw bookingNotFound()
    return { booking, table }
  }

  /** No-show (GM-203): `emptySeats` of the booking stayed empty (all of them when left out). */
  @Post('bookings/:bookingId/no-show')
  @HttpCode(200)
  async noShow(@CurrentPartner() user: PartnerUser, @Param('bookingId') bookingId: string, @Body() body: Record<string, unknown>) {
    await this.requireActive(user)
    const { booking, table } = await this.myBooking(user, bookingId)
    const updated = await this.bookings.noShow(booking, body.emptySeats, user.fullName)
    return { success: true, data: this.row(updated, table, true) }
  }

  @Post('interest-tables/:itId/invitees/:inviteeId/cancel')
  @HttpCode(200)
  async cancelInvite(@CurrentPartner() user: PartnerUser) {
    await this.requireActive(user)
    throw inviteNotFound()
  }

  @Get('interest-tables/:itId/invitees')
  async invitees(@CurrentPartner() user: PartnerUser, @Param('itId') itId: string) {
    const t = await this.one(user, itId)
    return { success: true, data: { inviteOnly: t.inviteOnly, items: [] } }
  }

  @Get('interest-tables')
  async list(@CurrentPartner() user: PartnerUser, @Query() q: Record<string, string>) {
    const page = Number(q.page ?? '1')
    const pageSize = Number(q.pageSize ?? '10')
    let visible = await Promise.all((await this.live(user)).map((t) => this.view(t)))
    if (q.status) visible = visible.filter((t) => t.status === q.status)
    const start = (page - 1) * pageSize
    const items = visible.slice(start, start + pageSize).map((t) => ({
      interestTableId: t.interestTableId,
      name: t.name,
      imageUrl: t.imageUrl,
      date: t.startDate,
      time: t.startTime,
      maxGuests: t.maxGuests,
      availabilityMode: t.availabilityMode,
      inviteOnly: t.inviteOnly,
      seatsBooked: t.seatsBooked,
      proMingler: t.proMingler,
      status: t.status,
    }))
    return { success: true, data: { items, page, pageSize, total: visible.length } }
  }

  @Get('interest-tables/:itId')
  async detail(@CurrentPartner() user: PartnerUser, @Param('itId') itId: string) {
    const { imageUrl: _image, seatsBooked: _booked, ...detail } = await this.view(await this.one(user, itId))
    return { success: true, data: detail }
  }

  @Post('bookings/:bookingId/cancel')
  @HttpCode(200)
  async cancelBooking(@CurrentPartner() user: PartnerUser, @Param('bookingId') bookingId: string) {
    await this.requireActive(user)
    const { booking } = await this.myBooking(user, bookingId)
    const cancelled = await this.bookings.cancel(booking, user.fullName)
    if (!cancelled) {
      throw profileError('ERR_BOOKING_NOT_CANCELLABLE', 'This booking can no longer be cancelled.', 409, { status: booking.status })
    }
    return { success: true, data: { bookingId: booking.id, status: 'CANCELLED' } }
  }

  @Get('bookings/:bookingId')
  async booking(@CurrentPartner() user: PartnerUser, @Param('bookingId') bookingId: string) {
    const { booking, table } = await this.myBooking(user, bookingId)
    const row = this.row(booking, table, true)
    return {
      success: true,
      data: {
        bookingId: row.bookingId,
        bookingRef: row.bookingRef,
        minglerName: row.minglerName,
        interestTableName: table.name,
        topic: table.topic?.name ?? '',
        menuOption: row.menuOption,
        date: row.date,
        time: to12h(table.startTime),
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

  @Get('minglers/:minglerId')
  mingler() {
    throw profileError('ERR_NOT_FOUND', 'Profile unavailable.', 404)
  }
}
