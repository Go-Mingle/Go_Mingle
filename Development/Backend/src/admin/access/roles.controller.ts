import { Controller, Delete, Get, HttpCode, Inject, OnModuleInit, Param, Patch, Post, Res, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Response } from 'express'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { adminUsers, roles } from '../../db/schema'
import { apiError, rawError } from '../../common/errors'
import { Body, num, Query } from '../../common/http'
import { AuditInterceptor } from '../../shared/changelog/audit.interceptor'
import { ChangeLogService } from '../../shared/changelog/changelog.service'
import { AdminGuard } from './admin.guard'
import type { RoleRow } from './admin-accounts.service'

const PERMISSION_SECTIONS = [
  {
    section: 'Configure',
    permissions: [
      { key: 'ROLES_AND_ACCESS', label: 'Roles and Access' },
      { key: 'USERS', label: 'User Management' },
      { key: 'CATEGORIES', label: 'Category Management' },
      { key: 'INTEREST_TOPICS', label: 'Interest Topics' },
      { key: 'LOYALTY_CONFIGURATION', label: 'Loyalty Configuration' },
      { key: 'AMENITIES', label: 'Amenities' },
      { key: 'PREFERENCE_QUESTIONS', label: 'Preference Questions' },
      { key: 'TIMER_SETTINGS', label: 'Timer Settings' },
      { key: 'EMAIL_TEMPLATES', label: 'Email Templates' },
    ],
  },
  {
    section: 'Manage',
    permissions: [
      { key: 'RESTAURANT_APPROVALS', label: 'Approvals Queue' },
      { key: 'MANAGE_RESTAURANTS', label: 'Manage Restaurants' },
      { key: 'MANAGE_MINGLERS', label: 'Manage Minglers' },
      { key: 'BOOKINGS', label: 'Bookings' },
      { key: 'REVIEWS', label: 'Reviews' },
      { key: 'FINANCES', label: 'Finances' },
      { key: 'CHANGE_LOG', label: 'Change Log' },
    ],
  },
]

const roleNotFound = () => rawError(404, { error: { code: 'ERR_ROLE_NOT_FOUND' } })

/** Roles & Access: /admin/api/v1/roles */
@Controller('admin/api/v1/roles')
@UseGuards(AdminGuard)
@UseInterceptors(AuditInterceptor)
export class RolesController implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly changeLog: ChangeLogService,
  ) {}

  onModuleInit() {
    this.changeLog.registerTarget('roles', async (id) => {
      const [r] = await this.db.select().from(roles).where(eq(roles.id, id))
      return r ? { record: this.shape(r, await this.assigned(r.id)) } : null
    })
  }

  /** How many admin users hold the role, counted live. */
  private async assigned(roleId: string): Promise<number> {
    return this.db.$count(adminUsers, and(eq(adminUsers.roleId, roleId), sql`${adminUsers.status} <> 'DELETED'`))
  }

  private shape(r: RoleRow, usersAssigned: number) {
    return {
      id: r.id,
      name: r.name,
      fullAccess: r.fullAccess,
      permissions: r.permissions ?? [],
      usersAssigned,
      deleted_at: r.deletedAt,
    }
  }

  private async live(): Promise<RoleRow[]> {
    return this.db.select().from(roles).where(isNull(roles.deletedAt)).orderBy(asc(roles.seq))
  }

  @Get()
  async list(@Query() q: Record<string, string>) {
    const page = num(q.page, 1)
    const pageSize = num(q.pageSize, 25)
    const search = (q.search ?? '').toLowerCase()
    const sortBy = q.sortBy === 'usersAssigned' ? 'usersAssigned' : 'name'
    const sortDir = q.sortDir === 'desc' ? 'desc' : 'asc'

    let active = await Promise.all((await this.live()).map(async (r) => this.shape(r, await this.assigned(r.id))))
    if (search) active = active.filter((r) => r.name.toLowerCase().includes(search))
    active.sort((a, b) => {
      const cmp = sortBy === 'usersAssigned' ? a.usersAssigned - b.usersAssigned : a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      return sortDir === 'asc' ? cmp : -cmp
    })
    const totalItems = active.length
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    return { items: active.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, totalItems, totalPages } }
  }

  @Get('active')
  async active() {
    return { items: (await this.live()).map((r) => ({ id: r.id, name: r.name })) }
  }

  @Get('permission-keys')
  permissionKeys() {
    return { success: true, data: { sections: PERMISSION_SECTIONS } }
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const [r] = await this.db.select().from(roles).where(and(eq(roles.id, id), isNull(roles.deletedAt)))
    if (!r) throw roleNotFound()
    return { success: true, data: this.shape(r, await this.assigned(r.id)) }
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: { name?: unknown; fullAccess?: unknown; permissions?: unknown }) {
    const [r] = await this.db
      .insert(roles)
      .values({
        id: `r${Date.now()}`,
        name: (body.name as string) ?? '',
        fullAccess: (body.fullAccess as boolean) ?? false,
        permissions: (body.permissions as string[]) ?? [],
      })
      .returning()
    return this.shape(r, 0)
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { name?: unknown; fullAccess?: unknown; permissions?: unknown }) {
    const [existing] = await this.db.select().from(roles).where(eq(roles.id, id))
    if (!existing) throw roleNotFound()
    const changes: Partial<typeof roles.$inferInsert> = {}
    if (body.name !== undefined) changes.name = body.name as string
    if (body.fullAccess !== undefined) changes.fullAccess = body.fullAccess as boolean
    if (body.permissions !== undefined) changes.permissions = body.permissions as string[]
    const [r] = Object.keys(changes).length
      ? await this.db.update(roles).set(changes).where(eq(roles.id, id)).returning()
      : [existing]
    return this.shape(r, await this.assigned(id))
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Res() res: Response) {
    const [existing] = await this.db.select().from(roles).where(eq(roles.id, id))
    if (!existing) throw roleNotFound()
    if ((await this.assigned(id)) > 0) {
      throw apiError(409, 'ERR_ROLE_HAS_ASSIGNED_USERS', 'Reassign the users who hold this role before deleting it.')
    }
    await this.db.update(roles).set({ deletedAt: new Date().toISOString() }).where(eq(roles.id, id))
    res.status(204).end()
  }
}
