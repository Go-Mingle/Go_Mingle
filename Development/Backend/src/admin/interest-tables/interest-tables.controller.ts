import { Controller, Delete, Get, HttpCode, Inject, OnModuleInit, Param, Patch, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { interestTableInvitees, interestTables } from '../../db/schema'
import { rawError } from '../../common/errors'
import { Body, Query, type Req as Request } from '../../common/http'
import { AuditInterceptor } from '../../shared/changelog/audit.interceptor'
import { ChangeLogService } from '../../shared/changelog/changelog.service'
import { InterestTablesService, type InterestTable } from '../../shared/interest-tables/interest-tables.service'
import { UsageService } from '../../shared/usage.service'
import { AdminGuard, CurrentAdmin } from '../access/admin.guard'
import type { AdminSession } from '../access/admin-accounts.service'
import { BookingsService, startsAt } from '../../shared/bookings/bookings.service'
import { AdminRestaurantsService } from '../restaurants/admin-restaurants.service'
import { bucketObjectUrl } from '../uploads.controller'

type Json = Record<string, any>

const fail = (status: number, code: string, message: string) => rawError(status, { success: false, error: { code, message } })
const notFound = () => fail(404, 'ERR_INTEREST_TABLE_NOT_FOUND', 'Not found')

/** Dates and times of interest tables are Pakistan time (UTC+05:00). */
const PKT_MS = 5 * 3_600_000
const pktNow = () => new Date(Date.now() + PKT_MS).toISOString().slice(0, 16).replace('T', ' ')

/** A live table must start in the future; a draft may be saved with any time. */
function assertStartsLater(startDate: unknown, startTime: unknown) {
  if (typeof startDate !== 'string' || typeof startTime !== 'string') return
  const at = startsAt({ startDate, startTime })
  if (Number.isFinite(at) && at <= Date.now()) {
    throw rawError(422, {
      success: false,
      error: {
        code: 'ERR_START_IN_PAST',
        message: `The start time has already passed in Pakistan (it is now ${pktNow()} there). Pick a later time.`,
        details: { fields: { startTime: 'Start time has already passed in Pakistan.' } },
      },
    })
  }
}

/** Repeated keys or comma-separated values, as one list. */
function multi(req: Request, key: string): string[] {
  const v = req.query[key]
  return (v === undefined ? [] : Array.isArray(v) ? v : [v])
    .flatMap((x) => String(x).split(','))
    .map((x) => x.trim())
    .filter(Boolean)
}

const dropNulls = <T extends Json>(o: T, keys: string[]): T => {
  for (const k of keys) if (o[k] === null) delete o[k]
  return o
}

/**
 * Interest tables in the Admin Panel:
 * /admin/api/v1/interest-tables and /admin/api/v1/restaurants/:rid/interest-tables
 */
@Controller('admin/api/v1')
@UseGuards(AdminGuard)
@UseInterceptors(AuditInterceptor)
export class InterestTablesController implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly tables: InterestTablesService,
    private readonly directory: AdminRestaurantsService,
    private readonly usage: UsageService,
    private readonly changeLog: ChangeLogService,
    private readonly bookings: BookingsService,
  ) {}

  onModuleInit() {
    this.changeLog.registerTarget('interest-tables', async (id) => {
      const t = await this.tables.find(id)
      return t ? { name: t.name, record: this.shape(t, await this.tables.restaurantNames()) } : null
    })
  }

  /** The full record the detail and restaurant screens read. */
  private shape(t: InterestTable, names: Map<string, string>) {
    return dropNulls(
      {
        id: t.id,
        name: t.name,
        topic: t.topic,
        assignedTable: t.assignedTable,
        restaurant: { id: t.restaurantId, name: names.get(t.restaurantId) ?? '' },
        seatsBooked: t.seatsBooked,
        minMinglers: 4,
        maxMinglers: t.maxGuests,
        maxGuests: t.maxGuests,
        minGuests: 4,
        startDate: t.startDate,
        startTime: t.startTime,
        durationHours: t.durationMinutes === null ? null : t.durationMinutes / 60,
        durationMinutes: t.durationMinutes,
        comboIds: t.comboIds,
        inviteList: t.inviteList,
        sponsorName: null,
        sponsorLogoUrl: null,
        eventImageUrl: t.eventImageUrl,
        availabilityMode: t.availabilityMode,
        inviteOnly: t.inviteOnly,
        prominglerEnabled: t.prominglerEnabled,
        prominglerMinglerId: t.prominglerMinglerId,
        timeLeft: t.timeLeft,
        status: t.status,
        created: t.created,
      } as Json,
      ['name', 'maxMinglers', 'maxGuests', 'startDate', 'startTime', 'durationMinutes', 'availabilityMode', 'prominglerMinglerId'],
    )
  }

  private async one(id: string): Promise<InterestTable> {
    const t = await this.tables.find(id)
    if (!t) throw notFound()
    return t
  }

  private async full(t: InterestTable) {
    return this.shape(t, await this.tables.restaurantNames())
  }

  // ── Lists ─────────────────────────────────────────────────────────────────

  /** Every interest table across restaurants. Only an over-long search is refused; other bad values are ignored. */
  @Get('interest-tables')
  async master(@Req() req: Request, @Query() q: Record<string, string>) {
    const search = (q.search ?? '').trim()
    if (search.length > 100) throw fail(400, 'ERR_VALIDATION', 'Search term too long.')
    const rawPage = parseInt(q.page ?? '1', 10)
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1
    const rawSize = parseInt(q.pageSize ?? '25', 10)
    const pageSize = [10, 25, 50].includes(rawSize) ? rawSize : 25
    const sortBy = ['interestTable', 'restaurant', 'dateTime', 'maxGuests'].includes(q.sortBy ?? '') ? q.sortBy : 'dateTime'
    const modes = multi(req, 'availabilityMode')
    const statuses = multi(req, 'status')
    const restaurantIds = multi(req, 'restaurantId')

    const names = await this.tables.restaurantNames()
    let items = await Promise.all(
      (await this.tables.all()).map(async (t) => {
        const [year, month, day] = (t.startDate ?? '').split('-')
        const pro = t.prominglerEnabled && t.prominglerMinglerId ? await this.usage.mingler(t.prominglerMinglerId) : null
        return {
          id: t.id,
          name: t.name ?? '',
          coverImageUrl: t.eventImageUrl,
          restaurant: { id: t.restaurantId, name: names.get(t.restaurantId) ?? '' },
          startDate: year && month && day ? `${day}-${month}-${year}` : (t.startDate ?? ''),
          startTime: t.startTime ?? '',
          maxGuests: t.maxGuests ?? 0,
          availabilityMode: t.availabilityMode ?? 'AVAILABLE_NOW',
          inviteOnly: t.inviteOnly,
          promingler: pro?.name ?? null,
          status: t.status,
        }
      }),
    )
    if (search) {
      const needle = search.toLowerCase()
      items = items.filter((i) => {
        const inName = i.name.toLowerCase().includes(needle)
        const inRestaurant = i.restaurant.name.toLowerCase().includes(needle)
        return q.searchField === 'interestTable' ? inName : q.searchField === 'restaurant' ? inRestaurant : inName || inRestaurant
      })
    }
    if (modes.length) items = items.filter((i) => modes.includes(i.availabilityMode))
    if (statuses.length) items = items.filter((i) => statuses.includes(i.status))
    if (restaurantIds.length) items = items.filter((i) => restaurantIds.includes(i.restaurant.id))
    if (q.inviteOnly === 'true' || q.inviteOnly === 'false') items = items.filter((i) => i.inviteOnly === (q.inviteOnly === 'true'))

    const when = (i: { startDate: string; startTime: string }) => `${i.startDate.split('-').reverse().join('-')} ${i.startTime}`
    items.sort((a, b) => {
      const cmp =
        sortBy === 'interestTable'
          ? a.name.localeCompare(b.name)
          : sortBy === 'restaurant'
            ? a.restaurant.name.localeCompare(b.restaurant.name)
            : sortBy === 'maxGuests'
              ? a.maxGuests - b.maxGuests
              : when(a).localeCompare(when(b))
      return q.sortOrder === 'asc' ? cmp : -cmp
    })
    const totalRecords = items.length
    return {
      success: true,
      data: {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        pagination: { page, pageSize, totalRecords, totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)) },
      },
    }
  }

  @Get('restaurants/:rid/interest-tables')
  async ofRestaurant(@Param('rid') rid: string, @Query() q: Record<string, string>) {
    const page = Math.max(1, parseInt(q.page ?? '1', 10))
    const rawSize = parseInt(q.pageSize ?? '10', 10)
    const pageSize = [10, 25, 50].includes(rawSize) ? rawSize : 10
    const search = (q.q ?? '').toLowerCase()

    let rows = await this.tables.ofRestaurant(rid)
    if (search) rows = rows.filter((t) => (t.name ?? '').toLowerCase().includes(search))
    if (q.status) rows = rows.filter((t) => t.status === q.status)
    const key = (t: InterestTable): string | number =>
      q.sortBy === 'name' ? (t.name ?? '') : q.sortBy === 'status' ? t.status : q.sortBy === 'seatsBooked' ? t.seatsBooked : t.created
    rows.sort((a, b) => {
      const x = key(a)
      const y = key(b)
      const cmp = typeof x === 'number' ? x - (y as number) : x.localeCompare(y as string)
      return q.sortOrder === 'DESC' ? -cmp : cmp
    })
    const names = await this.tables.restaurantNames()
    const totalRecords = rows.length
    return {
      success: true,
      data: {
        items: rows.slice((page - 1) * pageSize, page * pageSize).map((t) => this.shape(t, names)),
        pagination: { page, pageSize, totalRecords, totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)) },
      },
    }
  }

  @Get('restaurants/:rid/lookups/interest-tables')
  async lookup(@Param('rid') rid: string) {
    const items = (await this.tables.ofRestaurant(rid))
      .map((t) => ({ interestTableId: t.id, interestTableName: t.name ?? '' }))
      .sort((a, b) => a.interestTableName.localeCompare(b.interestTableName))
    return { success: true, data: { items } }
  }

  /** Whether a table area can take an interest table in that slot. */
  @Get('restaurants/:rid/tables/:tid/availability-check')
  availability() {
    return { success: true, data: { assignable: true, reason: null } }
  }

  // ── Create, edit, lifecycle ───────────────────────────────────────────────

  /** `publish: false` saves a Draft; otherwise it goes live as Pending (bookable now) or Coming Soon. */
  @Post('restaurants/:rid/interest-tables')
  @HttpCode(201)
  async create(@Param('rid') rid: string, @Body() body: Json) {
    const restaurant = await this.directory.known(rid)
    if (!restaurant) throw fail(404, 'ERR_RESTAURANT_NOT_FOUND', 'Restaurant not found.')
    const refs = await this.tables.refs(rid, body.topicId, body.restaurantTableId)
    const status = body.publish ? (body.availabilityMode === 'COMING_SOON' ? 'COMING_SOON' : 'PENDING') : 'DRAFT'
    if (status !== 'DRAFT') assertStartsLater(body.startDate, body.startTime)
    const hoursLeft = Math.floor((startsAt({ startDate: body.startDate, startTime: body.startTime }) - Date.now()) / 3_600_000)
    const [created] = await this.db
      .insert(interestTables)
      .values({
        id: `it-v1-${Date.now()}`,
        restaurantId: rid,
        name: body.name ?? null,
        ...refs,
        maxGuests: body.maxGuests ?? null,
        startDate: body.startDate ?? null,
        startTime: body.startTime ?? null,
        durationMinutes: body.durationMinutes ?? null,
        comboIds: body.menuOptionIds ?? [],
        inviteList: body.inviteList ?? [],
        eventImageUrl: body.coverImageKey ? bucketObjectUrl(body.coverImageKey) : null,
        availabilityMode: body.availabilityMode ?? null,
        inviteOnly: body.inviteOnly ?? false,
        prominglerEnabled: body.prominglerEnabled ?? false,
        prominglerMinglerId: body.prominglerMinglerId ?? null,
        timeLeft: `${hoursLeft}h`,
        status,
        created: new Date().toISOString(),
      })
      .returning()
    return { success: true, data: await this.full(created) }
  }

  @Get('interest-tables/:id')
  async get(@Param('id') id: string) {
    return { success: true, data: await this.full(await this.one(id)) }
  }

  @Patch('interest-tables/:id')
  async update(@Param('id') id: string, @Body() body: Json) {
    const existing = await this.one(id)
    if (['CANCELLED', 'COMPLETED'].includes(existing.status)) {
      throw fail(409, 'ERR_INVALID_STATE', `This interest table is ${existing.status.toLowerCase()} and can no longer be edited.`)
    }
    if ((body.startDate !== undefined || body.startTime !== undefined) && existing.status !== 'DRAFT') {
      assertStartsLater(body.startDate ?? existing.startDate, body.startTime ?? existing.startTime)
    }
    if (body.maxGuests !== undefined && Number(body.maxGuests) < existing.seatsBooked) {
      throw fail(409, 'ERR_BELOW_BOOKED', `${existing.seatsBooked} seats are already booked, so max guests can't be lower than that.`)
    }
    const changes: Partial<InterestTable> = {}
    if (body.name !== undefined) changes.name = body.name
    if (body.maxGuests !== undefined) changes.maxGuests = body.maxGuests
    if (body.startDate !== undefined) changes.startDate = body.startDate
    if (body.startTime !== undefined) changes.startTime = body.startTime
    if (body.availabilityMode !== undefined) changes.availabilityMode = body.availabilityMode
    if (body.inviteOnly !== undefined) changes.inviteOnly = body.inviteOnly
    if (body.durationMinutes !== undefined) changes.durationMinutes = body.durationMinutes
    if (body.menuOptionIds !== undefined) changes.comboIds = body.menuOptionIds
    if (body.coverImageKey !== undefined) changes.eventImageUrl = body.coverImageKey ? bucketObjectUrl(body.coverImageKey) : null
    if (body.prominglerEnabled !== undefined) changes.prominglerEnabled = body.prominglerEnabled
    if (body.prominglerMinglerId !== undefined) changes.prominglerMinglerId = body.prominglerMinglerId
    if (body.topicId !== undefined || body.restaurantTableId !== undefined) {
      Object.assign(
        changes,
        await this.tables.refs(existing.restaurantId, body.topicId ?? existing.topic?.id, body.restaurantTableId ?? existing.assignedTable?.id),
      )
    }
    const updated = Object.keys(changes).length ? await this.tables.update(id, changes) : existing
    return { success: true, data: await this.full(updated) }
  }

  @Delete('interest-tables/:id')
  async remove(@Param('id') id: string) {
    await this.one(id)
    if ((await this.bookings.ofTable(id)).length > 0) {
      throw fail(409, 'ERR_HAS_BOOKINGS', 'This interest table has bookings, so it cannot be deleted. Cancel it instead; its Minglers get their money back.')
    }
    await this.db.delete(interestTables).where(eq(interestTables.id, id))
    await this.db.delete(interestTableInvitees).where(eq(interestTableInvitees.interestTableId, id))
    return { success: true, data: { id, deleted: true } }
  }

  /** Coming Soon → bookable now. */
  @Post('interest-tables/:id/make-available')
  @HttpCode(200)
  async makeAvailable(@Param('id') id: string) {
    await this.one(id)
    const t = await this.tables.update(id, { availabilityMode: 'AVAILABLE_NOW', status: 'PENDING' })
    return { success: true, data: { id, status: t.status, availability: 'AVAILABLE_NOW' } }
  }

  @Post('interest-tables/:id/publish')
  @HttpCode(200)
  async publish(@Param('id') id: string) {
    const existing = await this.one(id)
    const t = await this.tables.update(id, { status: existing.availabilityMode === 'COMING_SOON' ? 'COMING_SOON' : 'PENDING' })
    return { success: true, data: await this.full(t) }
  }

  @Post('interest-tables/:id/cancel')
  @HttpCode(200)
  async cancel(@Param('id') id: string, @CurrentAdmin() admin: AdminSession) {
    const existing = await this.one(id)
    if (['CANCELLED', 'COMPLETED'].includes(existing.status)) {
      throw fail(409, 'ERR_INVALID_STATE', `This interest table is already ${existing.status.toLowerCase()}.`)
    }
    // Every booking goes with it, and each Mingler's card hold or payment is given back.
    const { cancelled, refundedPkr } = await this.bookings.cancelAllOfTable(id, `${admin.fullName} (table cancelled)`)
    await this.tables.update(id, { status: 'CANCELLED' })
    return { success: true, data: { id, status: 'CANCELLED', cancelledCount: cancelled, refundedPkr } }
  }

  @Post('interest-tables/:id/promingler')
  @HttpCode(200)
  async promingler(@Param('id') id: string, @Body() body: Json) {
    await this.one(id)
    if (!body.prominglerMinglerId) throw fail(400, 'ERR_VALIDATION', 'prominglerMinglerId is required')
    const t = await this.tables.update(id, { prominglerEnabled: true, prominglerMinglerId: String(body.prominglerMinglerId) })
    return { success: true, data: await this.full(t) }
  }

  // ── Menu options and invitees ─────────────────────────────────────────────

  @Get('interest-tables/:id/menu-options')
  async menuOptions(@Param('id') id: string) {
    const t = await this.one(id)
    const items = (await this.tables.menuOptionsOf(t)).map((o) => ({ id: o.comboId, name: o.name, pricePkr: o.pricePkr, courses: o.courses }))
    return { success: true, data: { items } }
  }

  private invitees(id: string) {
    return this.db.select().from(interestTableInvitees).where(eq(interestTableInvitees.interestTableId, id)).orderBy(asc(interestTableInvitees.seq))
  }

  private invitee = (i: typeof interestTableInvitees.$inferSelect) => ({
    minglerId: i.minglerId,
    fullName: i.fullName,
    avatarUrl: null,
    isPromingler: i.isPromingler,
    dateInvited: i.dateInvited,
    status: i.status,
  })

  @Get('interest-tables/:id/invitees')
  async listInvitees(@Param('id') id: string, @Query() q: Record<string, string>) {
    await this.one(id)
    const page = Math.max(1, parseInt(q.page ?? '1', 10))
    const pageSize = parseInt(q.pageSize ?? '10', 10)
    const search = (q.q ?? '').toLowerCase()
    let items = (await this.invitees(id)).map(this.invitee)
    if (q.status) items = items.filter((i) => i.status === q.status)
    if (search) items = items.filter((i) => i.fullName.toLowerCase().includes(search))
    const totalRecords = items.length
    return {
      success: true,
      data: {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        pagination: { page, pageSize, totalRecords, totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)) },
      },
    }
  }

  /** Inviting someone already on the list returns their invite (200, not 201). */
  @Post('interest-tables/:id/invitees')
  async invite(@Param('id') id: string, @Body() body: Json, @Req() req: Request) {
    await this.one(id)
    const mingler = await this.usage.mingler(String(body.minglerId ?? ''))
    if (!mingler) throw fail(404, 'ERR_MINGLER_NOT_FOUND', 'Mingler not found.')
    const where = and(eq(interestTableInvitees.interestTableId, id), eq(interestTableInvitees.minglerId, mingler.id))
    const [existing] = await this.db.select().from(interestTableInvitees).where(where)
    if (existing) {
      req.res?.status(200)
      return { success: true, data: this.invitee(existing) }
    }
    const [row] = await this.db
      .insert(interestTableInvitees)
      .values({ interestTableId: id, minglerId: mingler.id, fullName: mingler.name, dateInvited: new Date().toISOString() })
      .returning()
    return { success: true, data: this.invitee(row) }
  }

  @Delete('interest-tables/:id/invitees/:minglerId')
  async uninvite(@Param('id') id: string, @Param('minglerId') minglerId: string) {
    await this.one(id)
    const rows = await this.db
      .delete(interestTableInvitees)
      .where(and(eq(interestTableInvitees.interestTableId, id), eq(interestTableInvitees.minglerId, minglerId)))
      .returning()
    return { success: true, data: { minglerId, removed: rows.length > 0 } }
  }
}
