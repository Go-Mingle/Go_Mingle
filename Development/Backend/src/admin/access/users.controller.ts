import { Controller, Delete, Get, HttpCode, Inject, OnModuleInit, Param, Patch, Post, Res, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Response } from 'express'
import { and, eq, isNull, ne } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { adminUsers, roles } from '../../db/schema'
import { apiError } from '../../common/errors'
import { Body, num, Query } from '../../common/http'
import { initialsOf, today } from '../../common/time'
import { hashPassword, meetsPasswordPolicy, normaliseEmail, POLICY_MESSAGE } from '../../auth/passwords'
import { TokensService } from '../../auth/tokens.service'
import { AuditInterceptor } from '../../shared/changelog/audit.interceptor'
import { ChangeLogService } from '../../shared/changelog/changelog.service'
import { AccountDirectory } from '../../shared/accounts/account-directory.service'
import { AdminGuard, CurrentAdmin } from './admin.guard'
import { AdminAccountsService, type AdminSession, type AdminUserRow } from './admin-accounts.service'
import { MailService } from '../../shared/email/mail.service'

const err = (code: string, message: string, status: number) => apiError(status, code, message, {})

/** Users (admin accounts): /admin/api/v1/users */
@Controller('admin/api/v1/users')
@UseGuards(AdminGuard)
@UseInterceptors(AuditInterceptor)
export class UsersController implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly accounts: AdminAccountsService,
    private readonly tokens: TokensService,
    private readonly directory: AccountDirectory,
    private readonly changeLog: ChangeLogService,
    private readonly mail: MailService,
  ) {}

  onModuleInit() {
    this.changeLog.registerTarget('users', async (id) => {
      const [u] = await this.db.select().from(adminUsers).where(and(eq(adminUsers.id, id), ne(adminUsers.status, 'DELETED')))
      return u ? { record: await this.record(u) } : null
    })
  }

  /** The Users-screen record (as the change log diffs it). */
  private async record(u: AdminUserRow) {
    return {
      id: u.id,
      fullName: u.fullName,
      username: u.username,
      email: u.email,
      role: await this.roleRef(u.roleId),
      roleId: u.roleId,
      status: u.status,
      lastActive: u.lastActive,
      createdAt: u.createdAt,
      initials: u.initials,
    }
  }

  /** The role as the users API returns it. */
  private async roleRef(roleId: string, liveOnly = false) {
    const [r] = await this.db
      .select()
      .from(roles)
      .where(liveOnly ? and(eq(roles.id, roleId), isNull(roles.deletedAt)) : eq(roles.id, roleId))
    return r ? { id: r.id, name: r.name, fullAccess: r.fullAccess } : null
  }

  private async response(u: AdminUserRow) {
    const role = await this.roleRef(u.roleId)
    return {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      role: role ?? { id: u.roleId, name: '', fullAccess: false },
      status: u.status,
      createdAt: u.createdAt,
    }
  }

  private async live(): Promise<AdminUserRow[]> {
    return this.db.select().from(adminUsers).where(ne(adminUsers.status, 'DELETED'))
  }

  private async isOnlyActiveSuperAdmin(targetId: string): Promise<boolean> {
    const active = []
    for (const u of await this.live()) {
      if (u.status === 'ACTIVE' && (await this.roleRef(u.roleId))?.fullAccess) active.push(u)
    }
    return active.length === 1 && active[0].id === targetId
  }

  private async find(id: string): Promise<AdminUserRow | undefined> {
    const [u] = await this.db.select().from(adminUsers).where(and(eq(adminUsers.id, id), ne(adminUsers.status, 'DELETED')))
    return u
  }

  @Get()
  async list(@Query() q: Record<string, string>, @CurrentAdmin() me: AdminSession) {
    const page = num(q.page, 1)
    const pageSize = num(q.pageSize, 25)
    const sortOrder = q.sortOrder ?? 'asc'
    const search = q.q ?? ''
    const statuses = (q.statuses ?? '').split(',').filter(Boolean)

    let items = (await this.live()).filter((u) => u.id !== me.id)
    if (search) {
      const s = search.toLowerCase()
      items = items.filter((u) => u.fullName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s))
    }
    if (statuses.length) items = items.filter((u) => statuses.includes(u.status))
    items.sort((a, b) => (sortOrder === 'asc' ? a.fullName.localeCompare(b.fullName) : b.fullName.localeCompare(a.fullName)))
    const totalRecords = items.length
    const totalPages = Math.ceil(totalRecords / pageSize) || 1
    const paged = items.slice((page - 1) * pageSize, page * pageSize)
    return {
      success: true,
      data: { items: await Promise.all(paged.map((u) => this.response(u))), pagination: { page, pageSize, totalRecords, totalPages } },
    }
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentAdmin() me: AdminSession) {
    if (id === me.id) throw err('ERR_SELF_MODIFICATION', 'Cannot operate on your own account.', 403)
    const u = await this.find(id)
    if (!u) throw err('ERR_USER_NOT_FOUND', 'User not found.', 404)
    return { success: true, data: await this.response(u) }
  }

  @Post()
  @HttpCode(201)
  async create(
    @Body()
    body: { fullName?: string; email?: string; roleId?: string; status?: string; password?: string; confirmPassword?: string },
    @CurrentAdmin() me: AdminSession,
  ) {
    const email = normaliseEmail(body.email)
    if (email && (await this.directory.emailInUse(email))) {
      throw apiError(409, 'ERR_EMAIL_IN_USE', 'Email already in use.')
    }
    if (!meetsPasswordPolicy(body.password)) throw apiError(422, 'ERR_INVALID_PASSWORD', POLICY_MESSAGE)
    if (body.confirmPassword !== undefined && body.confirmPassword !== body.password) {
      throw apiError(422, 'ERR_PASSWORD_MISMATCH', 'Passwords do not match.')
    }
    const role = await this.roleRef(String(body.roleId ?? ''), true)
    if (!role) throw err('ERR_ROLE_NOT_FOUND', 'Choose an existing role.', 422)
    const fullName = String(body.fullName ?? '')
    const [u] = await this.db
      .insert(adminUsers)
      .values({
        id: await this.accounts.nextUserId(),
        fullName,
        username: email.split('@')[0],
        email,
        roleId: role.id,
        status: body.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
        lastActive: today(),
        createdAt: new Date().toISOString(),
        initials: initialsOf(fullName.split(' ').join(' ')),
        passwordHash: hashPassword(body.password),
      })
      .returning()
    if (u.status === 'ACTIVE') {
      await this.mail.send('admin_user_welcome', { email: u.email, name: u.fullName }, {
        name: u.fullName,
        roleName: role.name,
        addedBy: me?.fullName ?? 'GoMingle',
        email: u.email,
      })
    }
    return { success: true, data: await this.response(u) }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { fullName?: string; roleId?: string; status?: 'ACTIVE' | 'SUSPENDED' },
    @CurrentAdmin() me: AdminSession,
  ) {
    if (id === me.id) throw err('ERR_SELF_MODIFICATION', 'Cannot operate on your own account.', 403)
    const existing = await this.find(id)
    if (!existing) throw err('ERR_USER_NOT_FOUND', 'User not found.', 404)
    if (await this.isOnlyActiveSuperAdmin(id)) throw err('ERR_LAST_SUPER_ADMIN', 'Cannot modify the last active super admin.', 409)
    const changes: Partial<AdminUserRow> = {}
    if (body.roleId !== undefined) {
      const role = await this.roleRef(body.roleId, true)
      if (!role) throw err('ERR_ROLE_NOT_FOUND', 'Choose an existing role.', 422)
      changes.roleId = role.id
    }
    if (body.fullName !== undefined) changes.fullName = body.fullName
    if (body.status !== undefined) changes.status = body.status
    const [u] = Object.keys(changes).length
      ? await this.db.update(adminUsers).set(changes).where(eq(adminUsers.id, id)).returning()
      : [existing]
    if (u.status !== 'ACTIVE') await this.tokens.revokeUser(id)
    return { success: true, data: await this.response(u) }
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentAdmin() me: AdminSession, @Res() res: Response) {
    if (id === me.id) throw err('ERR_SELF_MODIFICATION', 'Cannot operate on your own account.', 403)
    if (await this.isOnlyActiveSuperAdmin(id)) throw err('ERR_LAST_SUPER_ADMIN', 'Cannot delete the last active super admin.', 409)
    if (await this.find(id)) {
      await this.db.update(adminUsers).set({ status: 'DELETED' }).where(eq(adminUsers.id, id))
      await this.tokens.revokeUser(id)
    }
    res.status(204).end()
  }

  @Post(':id/change-password')
  @HttpCode(200)
  async changePassword(@Param('id') id: string, @Body() body: { newPassword?: string; confirmNewPassword?: string }) {
    if (body.confirmNewPassword !== undefined && body.confirmNewPassword !== body.newPassword) {
      throw apiError(422, 'ERR_PASSWORD_MISMATCH', 'Passwords do not match.')
    }
    if (!meetsPasswordPolicy(body.newPassword)) throw apiError(422, 'ERR_INVALID_PASSWORD', POLICY_MESSAGE)
    const u = await this.find(id)
    if (!u) throw err('ERR_USER_NOT_FOUND', 'User not found.', 404)
    await this.accounts.setPasswordHash(id, hashPassword(body.newPassword))
    await this.tokens.revokeUser(id)
    return { success: true, data: { id: u.id, email: u.email, passwordChangedAt: new Date().toISOString() } }
  }
}
