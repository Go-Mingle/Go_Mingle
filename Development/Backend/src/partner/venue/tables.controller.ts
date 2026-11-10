import { Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { restaurantTables, type TimeRange, type WeekAvailability } from '../../db/schema'
import { Body } from '../../common/http'
import { CountersService } from '../../shared/counters.service'
import { RestaurantsService, type Restaurant } from '../../shared/restaurants/restaurants.service'
import { UsageService } from '../../shared/usage.service'
import { CurrentPartner, PartnerGuard } from '../access/partner.guard'
import type { PartnerUser } from '../access/partner-accounts.service'
import { profileError, readOnly } from '../profile/profile.service'

type Json = Record<string, unknown>
type Row = typeof restaurantTables.$inferSelect

const WEEKDAYS = ['0', '1', '2', '3', '4', '5', '6']
const NAME_MAX = 150
const RANGES_PER_DAY_MAX = 6
const WIRE_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

const invalid = (fields: Record<string, string>) => profileError('ERR_VALIDATION', 'Please correct the highlighted fields.', 422, { fields })
const notFound = () => profileError('ERR_NOT_FOUND', 'Table area not found.', 404)

function minutes(value: unknown): number | null {
  const match = WIRE_TIME.exec(String(value))
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

/** Problems with one day's ranges, by the field path the form highlights (`availability.1[0].end`). */
function rangeErrors(day: string, ranges: TimeRange[]): Record<string, string> {
  const fields: Record<string, string> = {}
  const path = (index: number, field: string) => `availability.${day}[${index}].${field}`
  ranges.forEach((range, index) => {
    const from = minutes(range?.start)
    const to = minutes(range?.end)
    if (from === null) fields[path(index, 'start')] = 'Time must be HH:MM (24-hour).'
    if (to === null) fields[path(index, 'end')] = 'Time must be HH:MM (24-hour).'
    // Also rejects a window that crosses midnight.
    if (from !== null && to !== null && to <= from) fields[path(index, 'end')] = 'End time must be after the start time.'
  })
  const ordered = ranges
    .filter((range) => minutes(range?.start) !== null && minutes(range?.end) !== null)
    .sort((a, b) => (minutes(a.start) ?? 0) - (minutes(b.start) ?? 0))
  // Touching ranges are fine; only a real overlap is refused.
  if (ordered.some((range, i) => i > 0 && (minutes(range.start) ?? 0) < (minutes(ordered[i - 1].end) ?? 0))) {
    fields[`availability.${day}`] = "Time ranges on the same day can't overlap."
  }
  return fields
}

/** The full week, every day present, from whatever days the request named. */
function toAvailability(body: Json): WeekAvailability {
  const source = (body.availability ?? {}) as Record<string, TimeRange[] | undefined>
  return Object.fromEntries(WEEKDAYS.map((day) => [day, (source[day] ?? []).map((r) => ({ start: r.start, end: r.end }))]))
}

const shape = (t: Row) => ({ tableId: t.tableId, name: t.name, isHidden: t.isHidden, availability: t.availability })

/** Table areas and their weekly availability: /partner/api/v1/partner/restaurant/tables */
@Controller('partner/api/v1/partner/restaurant/tables')
@UseGuards(PartnerGuard)
export class TablesController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly restaurants: RestaurantsService,
    private readonly counters: CountersService,
    private readonly usage: UsageService,
  ) {}

  private all(restaurantId: string): Promise<Row[]> {
    return this.db.select().from(restaurantTables).where(eq(restaurantTables.restaurantId, restaurantId)).orderBy(asc(restaurantTables.seq))
  }

  private async editable(user: PartnerUser): Promise<Restaurant> {
    const r = await this.restaurants.ensure(user.restaurantId)
    if (r.status === 'PENDING') throw readOnly()
    return r
  }

  private async validate(restaurantId: string, body: Json, exceptId?: string) {
    const unknown = Object.keys(body).filter((key) => key !== 'name' && key !== 'availability')
    if (unknown.length > 0) throw invalid({ [unknown[0]]: 'Unrecognised field.' })

    const fields: Record<string, string> = {}
    if (typeof body.name !== 'string' || !body.name.trim()) fields.name = 'Table name is required.'
    else if (body.name.trim().length > NAME_MAX) fields.name = `Table name must be ${NAME_MAX} characters or fewer.`

    const availability = body.availability
    if (availability !== undefined) {
      if (typeof availability !== 'object' || availability === null || Array.isArray(availability)) {
        fields.availability = 'Availability must be an object keyed by weekday.'
      } else {
        for (const [day, value] of Object.entries(availability as Json)) {
          if (!WEEKDAYS.includes(day)) fields[`availability.${day}`] = 'Weekday must be "0" (Sunday) through "6" (Saturday).'
          else if (!Array.isArray(value)) fields[`availability.${day}`] = 'Ranges must be an array.'
          else if (value.length > RANGES_PER_DAY_MAX) fields[`availability.${day}`] = `A day can have at most ${RANGES_PER_DAY_MAX} time ranges.`
          else Object.assign(fields, rangeErrors(day, value as TimeRange[]))
        }
      }
    }
    if (Object.keys(fields).length > 0) throw invalid(fields)

    // After the shape, so a request wrong in both ways reports the fixable fields first.
    const candidate = (body.name as string).trim().toLowerCase()
    if ((await this.all(restaurantId)).some((t) => t.tableId !== exceptId && t.name.trim().toLowerCase() === candidate)) {
      throw profileError('ERR_TABLE_NAME_DUPLICATE', 'A table area with this name already exists.', 409, { field: 'name' })
    }
  }

  /** Hidden areas included. Readable in every state, so the tab can show read-only under review. */
  @Get()
  async list(@CurrentPartner() user: PartnerUser) {
    const r = await this.restaurants.ensure(user.restaurantId)
    return { success: true, data: { items: (await this.all(r.id)).map(shape) } }
  }

  @Post()
  @HttpCode(201)
  async create(@CurrentPartner() user: PartnerUser, @Body() body: Json) {
    const r = await this.editable(user)
    await this.validate(r.id, body)
    const [row] = await this.db
      .insert(restaurantTables)
      .values({
        restaurantId: r.id,
        tableId: `t-${await this.counters.next(r.id, 'table')}`,
        name: (body.name as string).trim(),
        availability: toAvailability(body),
      })
      .returning()
    return { success: true, data: shape(row) }
  }

  @Patch(':tableId/visibility')
  async visibility(@CurrentPartner() user: PartnerUser, @Param('tableId') tableId: string, @Body() body: Json) {
    const r = await this.editable(user)
    const where = and(eq(restaurantTables.restaurantId, r.id), eq(restaurantTables.tableId, tableId))
    const [table] = await this.db.select().from(restaurantTables).where(where)
    if (!table) throw notFound()
    if (typeof body.hidden !== 'boolean') throw profileError('ERR_VALIDATION', 'Invalid request.', 422)
    await this.db.update(restaurantTables).set({ isHidden: body.hidden }).where(where)
    return { success: true, data: { tableId, isHidden: body.hidden } }
  }

  /** Replaces the name and the whole week. */
  @Patch(':tableId')
  async update(@CurrentPartner() user: PartnerUser, @Param('tableId') tableId: string, @Body() body: Json) {
    const r = await this.editable(user)
    const where = and(eq(restaurantTables.restaurantId, r.id), eq(restaurantTables.tableId, tableId))
    if (!(await this.db.select().from(restaurantTables).where(where)).length) throw notFound()
    await this.validate(r.id, body, tableId)
    const [row] = await this.db
      .update(restaurantTables)
      .set({ name: (body.name as string).trim(), availability: toAvailability(body) })
      .where(where)
      .returning()
    return { success: true, data: shape(row) }
  }

  @Delete(':tableId')
  async remove(@CurrentPartner() user: PartnerUser, @Param('tableId') tableId: string) {
    const r = await this.editable(user)
    const where = and(eq(restaurantTables.restaurantId, r.id), eq(restaurantTables.tableId, tableId))
    if (!(await this.db.select().from(restaurantTables).where(where)).length) throw notFound()
    const upcomingTables = await this.usage.upcomingTablesUsingTable(r.id, tableId)
    if (upcomingTables) {
      throw profileError('ERR_TABLE_IN_USE', "This table area can't be deleted — it's assigned to one or more upcoming interest tables.", 409, {
        upcomingTables,
      })
    }
    await this.db.delete(restaurantTables).where(where)
    return { success: true, data: { tableId, deleted: true } }
  }
}
