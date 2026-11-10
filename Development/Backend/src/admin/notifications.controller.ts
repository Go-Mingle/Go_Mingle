import { Controller, Get, Inject, Param, Patch, UseGuards } from '@nestjs/common'
import { desc, eq, isNull } from 'drizzle-orm'
import { DB, type Db } from '../db/database'
import { adminNotifications } from '../db/schema'
import { rawError } from '../common/errors'
import { num, Query } from '../common/http'
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
  constructor(@Inject(DB) private readonly db: Db) {}

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
    const rows = (await this.all()).sort((a, b) => sortable(b.createdAt).localeCompare(sortable(a.createdAt)))
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
      const cmp = sortable(a.createdAt).localeCompare(sortable(b.createdAt))
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
}
