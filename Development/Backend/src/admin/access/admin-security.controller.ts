import { Controller, Delete, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common'
import type { Request } from 'express'
import { apiError } from '../../common/errors'
import { Body } from '../../common/http'
import { checkPassword } from '../../auth/passwords'
import { TokensService } from '../../auth/tokens.service'
import { ChangeLogService } from '../../shared/changelog/changelog.service'
import { AdminAccountsService, type AdminSession } from './admin-accounts.service'
import { AdminSecurityService } from './admin-security.service'
import { resolveAdmin, type AdminRequest } from './admin.guard'

/**
 * The Security page (GM-346): /admin/api/v1/security/*.
 *
 * Deliberately not behind AdminGuard's two-step rule: an admin the panel
 * requires to turn on two-step sign-in must still be able to reach this page
 * to do it.
 */
@Controller('admin/api/v1/security')
export class AdminSecurityController {
  constructor(
    private readonly accounts: AdminAccountsService,
    private readonly tokens: TokensService,
    private readonly security: AdminSecurityService,
    private readonly changeLog: ChangeLogService,
  ) {}

  private me(req: Request) {
    return resolveAdmin(req, this.tokens, this.accounts, this.security)
  }

  private needPassword(user: AdminSession, password: unknown) {
    if (!checkPassword(user.passwordHash, typeof password === 'string' ? password : undefined)) {
      throw apiError(400, 'ERR_CURRENT_PASSWORD_INCORRECT', 'Current password is incorrect')
    }
  }

  @Get()
  async overview(@Req() req: Request) {
    const user = await this.me(req)
    const policy = await this.security.policy()
    return {
      twoStep: this.security.status(user, policy),
      policy,
      canChangePolicy: Boolean(user.role?.fullAccess),
    }
  }

  // ── Two-step sign-in ──────────────────────────────────────────────────────

  /** A new secret for the authenticator app (not active until confirmed). */
  @Post('two-step/setup')
  @HttpCode(200)
  async setup(@Req() req: Request) {
    const user = await this.me(req)
    if (this.security.enabled(user)) throw apiError(409, 'ERR_TWO_STEP_ON', 'Two-step sign-in is already on.')
    return this.security.beginSetup(user)
  }

  /** Confirms with the first code; returns the backup codes, shown only now. */
  @Post('two-step/enable')
  @HttpCode(200)
  async enable(@Req() req: Request, @Body() body: { code?: unknown }) {
    const user = await this.me(req)
    if (this.security.enabled(user)) throw apiError(409, 'ERR_TWO_STEP_ON', 'Two-step sign-in is already on.')
    const backupCodes = await this.security.confirmSetup(user, body.code)
    if (!backupCodes) throw apiError(400, 'ERR_INVALID_CODE', "That code didn't match. Check the time on your phone and try the newest code.")
    await this.audit(req, user, 'Turned on two-step sign-in')
    return { backupCodes }
  }

  @Post('two-step/disable')
  @HttpCode(200)
  async disable(@Req() req: Request, @Body() body: { password?: unknown }) {
    const user = await this.me(req)
    this.needPassword(user, body.password)
    if ((await this.security.policy()).requireTwoStep) {
      throw apiError(409, 'ERR_TWO_STEP_REQUIRED', 'Two-step sign-in is required for every admin, so it stays on.')
    }
    await this.security.disable(user)
    await this.audit(req, user, 'Turned off two-step sign-in')
    return { enabled: false }
  }

  @Post('two-step/backup-codes')
  @HttpCode(200)
  async backupCodes(@Req() req: Request, @Body() body: { password?: unknown }) {
    const user = await this.me(req)
    this.needPassword(user, body.password)
    if (!this.security.enabled(user)) throw apiError(409, 'ERR_TWO_STEP_OFF', 'Turn on two-step sign-in first.')
    return { backupCodes: await this.security.newBackupCodes(user) }
  }

  // ── Sessions ──────────────────────────────────────────────────────────────

  @Get('sessions')
  async sessions(@Req() req: Request) {
    const user = await this.me(req)
    const current = (req as AdminRequest).adminSessionId ?? null
    const rows = await this.security.list(user.id)
    return {
      items: rows.map((s) => ({
        id: s.id,
        userAgent: s.userAgent,
        ip: s.ip,
        method: s.method,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        current: s.id === current,
      })),
    }
  }

  @Delete('sessions/:id')
  @HttpCode(200)
  async signOut(@Req() req: Request, @Param('id') id: string) {
    const user = await this.me(req)
    if (!(await this.security.revoke(user.id, id))) throw apiError(404, 'ERR_SESSION_NOT_FOUND', 'That sign-in is already signed out.')
    await this.tokens.revokeSession(id)
    return { id, signedOut: true }
  }

  /** Signs out every other device; this one stays signed in. */
  @Post('sessions/sign-out-others')
  @HttpCode(200)
  async signOutOthers(@Req() req: Request) {
    const user = await this.me(req)
    const keep = (req as AdminRequest).adminSessionId ?? null
    const ids = await this.security.revokeOthers(user.id, keep)
    for (const id of ids) await this.tokens.revokeSession(id)
    return { signedOut: ids.length }
  }

  // ── Policy (super admins) ─────────────────────────────────────────────────

  @Put('policy')
  async setPolicy(@Req() req: Request, @Body() body: { requireTwoStep?: unknown }) {
    const user = await this.me(req)
    if (!user.role?.fullAccess) throw apiError(403, 'ERR_FORBIDDEN', 'Only a super admin can change this.')
    const requireTwoStep = body.requireTwoStep === true
    // Don't let the switch lock its own author out of the panel.
    if (requireTwoStep && !this.security.enabled(user)) {
      throw apiError(409, 'ERR_TWO_STEP_OFF', 'Turn on two-step sign-in for your own account first.')
    }
    const before = await this.security.policy()
    const policy = await this.security.setPolicy({ requireTwoStep })
    if (before.requireTwoStep !== policy.requireTwoStep) {
      await this.audit(
        req,
        user,
        policy.requireTwoStep ? 'Two-step sign-in is now required for every admin' : 'Two-step sign-in is now optional',
      )
    }
    return policy
  }

  private async audit(_req: Request, user: AdminSession, note: string) {
    await this.changeLog.record({
      method: 'POST',
      path: '/api/v1/security',
      body: {},
      adminUser: user,
      target: { id: user.id, name: user.fullName, record: {} },
      result: null,
      note,
    })
  }
}
