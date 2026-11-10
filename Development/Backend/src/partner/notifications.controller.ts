import { Controller, Get, Inject, Param, Patch, Req, UseGuards } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { DB, type Db } from '../db/database'
import { partnerNotifications } from '../db/schema'
import { Query, type Req as Request } from '../common/http'
import { karachiIso } from '../shared/notifications/notifications.service'
import { CurrentPartner, PartnerGuard } from './access/partner.guard'
import type { PartnerUser } from './access/partner-accounts.service'
import { profileError } from './profile/profile.service'

type Row = typeof partnerNotifications.$inferSelect

/** The types the Notifications screen can filter by. */
const TYPE_CATALOGUE = [
  { type: 'IT_CANCELLED', label: 'Interest table cancelled' },
  { type: 'IT_CONFIRMED', label: 'Interest table confirmed' },
  { type: 'IT_CREATED', label: 'New interest table created' },
  { type: 'MINGLER_CANCELLED_BOOKING', label: 'Mingler cancelled a booking' },
  { type: 'PROMINGLER_UPDATED', label: 'Promingler updated' },
]
const KNOWN_TYPES = new Set(TYPE_CATALOGUE.map((t) => t.type))
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const RECENT_LIMIT = 7

const invalid = () => profileError('ERR_VALIDATION', 'Please check the values and try again.', 422)
const karachiToday = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10)

const item = (n: Row) => ({
  id: n.id,
  isRead: n.readAt !== null,
  createdAt: n.createdAt,
  type: n.type,
  title: n.title,
  body: n.body,
  deepLink: n.deepLink,
  metadata: n.metadata,
})

/** The restaurant's inbox: /partner/api/v1/partner/notifications. Read state is one-way. */
@Controller('partner/api/v1/partner/notifications')
@UseGuards(PartnerGuard)
export class PartnerNotificationsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  private all(restaurantId: string): Promise<Row[]> {
    return this.db.select().from(partnerNotifications).where(eq(partnerNotifications.restaurantId, restaurantId))
  }

  private unread = (rows: Row[]) => rows.filter((n) => n.readAt === null).length

  @Get('unread-count')
  async unreadCount(@CurrentPartner() user: PartnerUser) {
    return { success: true, data: { unreadCount: this.unread(await this.all(user.restaurantId)) } }
  }

  /** The bell's dropdown: the newest few. */
  @Get('recent')
  async recent(@CurrentPartner() user: PartnerUser) {
    const rows = await this.all(user.restaurantId)
    const items = [...rows]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.seq - a.seq)
      .slice(0, RECENT_LIMIT)
      .map(item)
    return { success: true, data: { unreadCount: this.unread(rows), items } }
  }

  @Get('types')
  types() {
    return { success: true, data: { items: TYPE_CATALOGUE } }
  }

  @Patch('read-all')
  async readAll(@CurrentPartner() user: PartnerUser) {
    const rows = await this.db
      .update(partnerNotifications)
      .set({ readAt: karachiIso() })
      .where(and(eq(partnerNotifications.restaurantId, user.restaurantId), isNull(partnerNotifications.readAt)))
      .returning({ id: partnerNotifications.id })
    return { success: true, data: { markedCount: rows.length, unreadCount: 0 } }
  }

  @Get()
  async list(@CurrentPartner() user: PartnerUser, @Query() q: Record<string, string>, @Req() req: Request) {
    // `type` arrives as repeated keys or comma-separated.
    const raw = req.query.type
    const types = (raw === undefined ? [] : Array.isArray(raw) ? raw : [raw]).flatMap((v) => String(v).split(',')).filter(Boolean)
    const { startDate, endDate } = q

    if (Boolean(startDate) !== Boolean(endDate)) {
      throw profileError('ERR_DATE_RANGE_INCOMPLETE', 'Please provide both a start and end date.', 400)
    }
    if (startDate && endDate && (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate) || startDate > endDate || endDate > karachiToday())) {
      throw profileError('ERR_DATE_RANGE_INVALID', 'Please provide a valid date range.', 400)
    }
    if (q.status && !['ALL', 'UNREAD', 'READ'].includes(q.status)) throw invalid()
    if (q.sortDir && !['desc', 'asc'].includes(q.sortDir)) throw invalid()
    if (q.pageSize && ![10, 25, 50].includes(Number(q.pageSize))) throw invalid()
    if (types.some((t) => !KNOWN_TYPES.has(t))) throw invalid()

    const everything = await this.all(user.restaurantId)
    let rows = [...everything]
    const search = q.search?.trim().toLowerCase()
    if (search) rows = rows.filter((n) => n.title.toLowerCase().includes(search) || n.body.toLowerCase().includes(search))
    if (types.length) rows = rows.filter((n) => types.includes(n.type))
    if (q.status === 'UNREAD') rows = rows.filter((n) => n.readAt === null)
    if (q.status === 'READ') rows = rows.filter((n) => n.readAt !== null)
    if (startDate && endDate) {
      const from = Date.parse(`${startDate}T00:00:00+05:00`)
      const to = Date.parse(`${endDate}T23:59:59+05:00`)
      rows = rows.filter((n) => Date.parse(n.createdAt) >= from && Date.parse(n.createdAt) <= to)
    }
    const ascending = q.sortDir === 'asc'
    rows.sort((a, b) => {
      const diff = Date.parse(a.createdAt) - Date.parse(b.createdAt)
      // Within the same second, the earlier one first in either direction.
      return diff !== 0 ? (ascending ? diff : -diff) : a.seq - b.seq
    })

    const pageSize = q.pageSize ? Number(q.pageSize) : 25
    const totalRecords = rows.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    const requested = Number(q.page)
    const page = Number.isInteger(requested) && requested >= 1 ? Math.min(requested, totalPages) : 1
    const start = (page - 1) * pageSize
    return {
      success: true,
      data: {
        unreadCount: this.unread(everything),
        items: rows.slice(start, start + pageSize).map(item),
        pagination: { page, pageSize, totalRecords, totalPages },
      },
    }
  }

  @Patch(':id/read')
  async markRead(@CurrentPartner() user: PartnerUser, @Param('id') id: string) {
    const where = and(eq(partnerNotifications.restaurantId, user.restaurantId), eq(partnerNotifications.id, id))
    const [n] = await this.db.select().from(partnerNotifications).where(where)
    if (!n) throw profileError('ERR_NOT_FOUND', 'Notification not found.', 404)
    if (n.readAt === null) await this.db.update(partnerNotifications).set({ readAt: karachiIso() }).where(where)
    return { success: true, data: { id, isRead: true, unreadCount: this.unread(await this.all(user.restaurantId)) } }
  }
}
