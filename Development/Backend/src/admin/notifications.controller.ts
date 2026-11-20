import { Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common'
import { AuditInterceptor } from '../shared/changelog/audit.interceptor'
import { desc, eq, isNull } from 'drizzle-orm'
import { DB, type Db } from '../db/database'
import { adminNotifications } from '../db/schema'
import { rawError } from '../common/errors'
import { Body, num, Query } from '../common/http'
import { NotificationsService } from '../shared/notifications/notifications.service'
import { adminStatus } from '../shared/restaurants/restaurants.service'
import { AdminRestaurantsService } from './restaurants/admin-restaurants.service'
import { AdminGuard, CurrentAdmin } from './access/admin.guard'
import type { AdminSession } from './access/admin-accounts.service'

type Row = typeof adminNotifications.$inferSelect

const TYPES = [
  { key: 'RESTAURANT_APPLICATION_SUBMITTED', label: 'New restaurant application' },
  { key: 'RESTAURANT_APPROVED', label: 'Restaurant approved' },
  { key: 'RESTAURANT_REJECTED', label: 'Restaurant rejected' },
  { key: 'RESTAURANT_SUSPENDED', label: 'Restaurant suspended' },
  { key: 'RESTAURANT_UNSUSPENDED', label: 'Restaurant reactivated' },
  { key: 'MINGLER_SUSPENDED', label: 'Mingler suspended' },
  { key: 'MINGLER_UNSUSPENDED', label: 'Mingler reactivated' },
]

/** `DD-MM-YYYY HH:mm` → `YYYY-MM-DD HH:mm`, which sorts and compares as text. */
const sortable = (stamp: string) => `${stamp.slice(6, 10)}-${stamp.slice(3, 5)}-${stamp.slice(0, 2)}${stamp.slice(10)}`

const item = (n: Row) => ({
  id: n.id,
  readAt: n.readAt,
  readByUserId: n.readByUserId,
  createdAt: n.createdAt,
  type: n.type,
  title: n.title,
  body: n.body,
  deepLink: n.deepLink,
  metadata: n.metadata,
})

/** The Admin Panel inbox, shared by all admins: /admin/api/v1/notifications */
@Controller('admin/api/v1/notifications')
@UseGuards(AdminGuard)
export class AdminNotificationsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly notifications: NotificationsService,
    private readonly restaurants: AdminRestaurantsService,
  ) {}

  /** Newest first. */
  private all(): Promise<Row[]> {
    return this.db.select().from(adminNotifications).orderBy(desc(adminNotifications.seq))
  }

  @Get('unread-count')
  async unreadCount() {
    return { success: true, data: { count: (await this.all()).filter((n) => !n.readAt).length } }
  }

  @Get('recent')
  async recent() {
    // Same-minute stamps tie; the insert order (seq) breaks the tie, so the order never flickers.
    const rows = (await this.all()).sort((a, b) => sortable(b.createdAt).localeCompare(sortable(a.createdAt)) || b.seq - a.seq)
    return { success: true, data: { items: rows.slice(0, 10).map(item) } }
  }

  @Get('types')
  types() {
    return { success: true, data: { types: TYPES } }
  }

  @Get()
  async list(@Query() q: Record<string, string>) {
    const search = (q.search ?? '').toLowerCase()
    const status = q.status ?? 'all'
    const page = Math.max(1, num(q.page, 1))
    const pageSize = num(q.pageSize, 25)

    let rows = await this.all()
    if (search) rows = rows.filter((n) => n.title.toLowerCase().includes(search) || n.body.toLowerCase().includes(search))
    if (q.type) rows = rows.filter((n) => n.type === q.type)
    if (status === 'unread') rows = rows.filter((n) => !n.readAt)
    if (status === 'read') rows = rows.filter((n) => !!n.readAt)
    const day = (n: Row) => sortable(n.createdAt).slice(0, 10)
    if (q.startDate) rows = rows.filter((n) => day(n) >= q.startDate)
    if (q.endDate) rows = rows.filter((n) => day(n) <= q.endDate)
    rows.sort((a, b) => {
      const cmp = sortable(a.createdAt).localeCompare(sortable(b.createdAt)) || a.seq - b.seq
      return q.sortDir === 'asc' ? cmp : -cmp
    })

    const totalItems = rows.length
    const start = (page - 1) * pageSize
    return {
      success: true,
      data: {
        items: rows.slice(start, start + pageSize).map(item),
        pagination: { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) },
      },
    }
  }

  @Patch('mark-all-read')
  async markAll(@CurrentAdmin() admin: AdminSession) {
    const markedAt = new Date().toISOString()
    const rows = await this.db
      .update(adminNotifications)
      .set({ readAt: markedAt, readByUserId: admin.id })
      .where(isNull(adminNotifications.readAt))
      .returning({ id: adminNotifications.id })
    return { success: true, data: { marked: rows.length, markedAt, markedByUserId: admin.id } }
  }

  /** Reading is one-way and keeps whoever read it first. */
  @Patch(':id/read')
  async markRead(@Param('id') id: string, @CurrentAdmin() admin: AdminSession) {
    const [n] = await this.db.select().from(adminNotifications).where(eq(adminNotifications.id, id))
    if (!n) throw rawError(404, { success: false, error: { code: 'ERR_NOTIFICATION_NOT_FOUND', message: 'Not found.' } })
    if (n.readAt) return { success: true, data: { id, marked: 0, readAt: n.readAt, readByUserId: n.readByUserId } }
    const readAt = new Date().toISOString()
    await this.db.update(adminNotifications).set({ readAt, readByUserId: admin.id }).where(eq(adminNotifications.id, id))
    return { success: true, data: { id, marked: 1, readAt, readByUserId: admin.id } }
  }

  /** Removes a notification from the shared admin inbox (GM-342). */
  @Delete(':id')
  @UseInterceptors(AuditInterceptor)
  async remove(@Param('id') id: string) {
    const rows = await this.db.delete(adminNotifications).where(eq(adminNotifications.id, id)).returning({ id: adminNotifications.id })
    if (!rows.length) throw rawError(404, { success: false, error: { code: 'ERR_NOTIFICATION_NOT_FOUND', message: 'Not found.' } })
    return { success: true, data: { id, deleted: true } }
  }

  /**
   * Sends a message from GoMingle to restaurants' Partner Portal inboxes
   * (GM-342): every live restaurant, or the ones named. Push to Minglers waits
   * for the Mingler app.
   */
  @Post('broadcast')
  @UseInterceptors(AuditInterceptor)
  @HttpCode(201)
  async broadcast(@Body() body: { title?: unknown; body?: unknown; restaurantIds?: unknown }, @CurrentAdmin() admin: AdminSession) {
    const title = String(body.title ?? '').trim()
    const text = String(body.body ?? '').trim()
    const bad = (message: string) => rawError(422, { success: false, error: { code: 'ERR_VALIDATION', message } })
    if (!title || title.length > 120) throw bad('A title of up to 120 characters is required.')
    if (!text || text.length > 1000) throw bad('A message of up to 1,000 characters is required.')
    const live = (await this.restaurants.all()).filter((r) => ['ACTIVE', 'SUSPENDED'].includes(adminStatus(r)))
    let targets = live
    if (body.restaurantIds !== undefined) {
      if (!Array.isArray(body.restaurantIds) || !body.restaurantIds.length) throw bad('Choose at least one restaurant, or leave the list out to message all.')
      const ids = new Set(body.restaurantIds.map(String))
      targets = live.filter((r) => ids.has(r.id))
      if (targets.length !== ids.size) throw bad('Some of the chosen restaurants could not be found.')
    }
    for (const r of targets) {
      await this.notifications.notifyPartner(r.id, {
        type: 'GOMINGLE_ANNOUNCEMENT',
        title,
        body: text,
        deepLink: '/notifications',
        metadata: { from: admin.fullName },
      })
    }
    return { success: true, data: { name: title, sent: targets.length } }
  }
}
