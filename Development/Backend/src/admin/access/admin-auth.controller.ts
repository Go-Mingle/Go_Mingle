import { Controller, Get, HttpCode, Patch, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { apiError } from '../../common/errors'
import { Body } from '../../common/http'
import { CodesService } from '../../auth/codes.service'
import { checkPassword, hashPassword, meetsPasswordPolicy } from '../../auth/passwords'
import { ADMIN_AUDIENCE, bearer, TokensService } from '../../auth/tokens.service'
import { AdminAccountsService, type AdminSession } from './admin-accounts.service'
import { resolveAdmin } from './admin.guard'

/**
 * Admin Panel authentication: /admin/api/v1/auth/*.
 * Login, refresh, logout, profile (/me), change password, forgot-password
 * (one-time code) and the lockout audit (5 failures → 15-minute lock).
 */
@Controller('admin/api/v1/auth')
export class AdminAuthController {
  constructor(
    private readonly accounts: AdminAccountsService,
    private readonly tokens: TokensService,
    private readonly codes: CodesService,
  ) {}

  private locked(user: AdminSession) {
    const unlocksAt = new Date(Date.now() + this.accounts.lockRemainingMs(user)).toISOString()
    return apiError(423, 'ERR_ACCOUNT_LOCKED', 'Account temporarily locked', { unlocksAt })
  }

  private issue(user: AdminSession) {
    return this.tokens.issue(
      { id: user.id, email: user.email, fullName: user.fullName, roleName: user.role?.name ?? ADMIN_AUDIENCE },
      ADMIN_AUDIENCE,
    )
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email?: string; password?: string }) {
    const user = await this.accounts.byEmail(body.email)
    if (user && this.accounts.lockRemainingMs(user)) throw this.locked(user)
    if (!user || !checkPassword(user.passwordHash, body.password)) {
      throw apiError(401, 'ERR_INVALID_CREDENTIALS', 'Invalid email or password')
    }
    if (user.status !== 'ACTIVE') throw apiError(403, 'ERR_ACCOUNT_SUSPENDED', 'Account suspended')
    await this.accounts.recordSuccess(user)
    return { ...(await this.issue(user)), user: this.accounts.profile(user) }
  }

  /** Lockout audit: the admin client calls this after every sign-in attempt. */
  @Post('record-login-result')
  @HttpCode(200)
  async recordLoginResult(@Body() body: { email?: string; succeeded?: boolean }) {
    const user = await this.accounts.byEmail(body.email)
    if (body.succeeded) {
      if (user) await this.accounts.recordSuccess(user)
      return { locked: false, remainingAttempts: 5 }
    }
    if (user && this.accounts.lockRemainingMs(user)) throw this.locked(user)
    const remainingAttempts = await this.accounts.recordFailure(user)
    if (user && remainingAttempts === 0) throw this.locked((await this.accounts.byId(user.id)) as AdminSession)
    return { locked: false, remainingAttempts }
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: { refreshToken?: string }) {
    const userId = await this.tokens.consume(body.refreshToken, ADMIN_AUDIENCE)
    const user = userId ? await this.accounts.byId(userId) : null
    if (!user || user.status !== 'ACTIVE') {
      throw apiError(401, 'ERR_REFRESH_INVALID', 'Refresh token invalid or expired')
    }
    return this.issue(user)
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const { claims } = this.tokens.verify(bearer(req), ADMIN_AUDIENCE)
    if (claims) await this.tokens.revokeUser(claims.sub)
    res.status(204).end()
  }

  @Get('me')
  async me(@Req() req: Request) {
    return this.accounts.profile(await resolveAdmin(req, this.tokens, this.accounts))
  }

  /** Renaming yourself (profile menu) renames your row on the Users screen too: it is the same row. */
  @Patch('me')
  async rename(@Req() req: Request, @Body() body: { fullName?: unknown }) {
    const user = await resolveAdmin(req, this.tokens, this.accounts)
    const fullName = String(body.fullName ?? '').trim()
    if (!fullName || fullName.length > 100) {
      throw apiError(400, 'ERR_VALIDATION', 'Full name is required (max 100 characters)')
    }
    await this.accounts.rename(user.id, fullName)
    return this.accounts.profile({ ...user, fullName })
  }

  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @Req() req: Request,
    @Body() body: { currentPassword?: string; newPassword?: string; confirmPassword?: string },
  ) {
    const user = await resolveAdmin(req, this.tokens, this.accounts)
    if (!checkPassword(user.passwordHash, body.currentPassword)) {
      throw apiError(400, 'ERR_CURRENT_PASSWORD_INCORRECT', 'Current password is incorrect')
    }
    if (body.confirmPassword !== undefined && body.confirmPassword !== body.newPassword) {
      throw apiError(400, 'ERR_PASSWORD_MISMATCH', 'Passwords do not match')
    }
    if (!meetsPasswordPolicy(body.newPassword)) {
      throw apiError(400, 'ERR_INVALID_PASSWORD', 'Password does not meet the policy')
    }
    await this.accounts.setPasswordHash(user.id, hashPassword(body.newPassword))
    await this.tokens.revokeUser(user.id)
    return {}
  }

  @Post('forgot-password/request-code')
  @HttpCode(200)
  async requestCode(@Body() body: { email?: string }) {
    // Same answer for unknown addresses: no account enumeration.
    if (await this.accounts.byEmail(body.email)) await this.codes.issue('admin-reset', String(body.email))
    return { codeSentAt: new Date().toISOString() }
  }

  @Post('forgot-password/verify-code')
  @HttpCode(200)
  async verifyCode(@Body() body: { email?: string; code?: unknown }) {
    const user = await this.accounts.byEmail(body.email)
    const result = await this.codes.check('admin-reset', String(body.email ?? ''), String(body.code ?? ''))
    if (!user || result === 'mismatch') throw apiError(400, 'ERR_INVALID_CODE', 'Invalid code')
    if (result === 'expired') throw apiError(400, 'ERR_CODE_EXPIRED', 'Code expired')
    await this.codes.clear('admin-reset', String(body.email))
    return { resetSessionToken: await this.codes.openResetSession(user.id, ADMIN_AUDIENCE) }
  }

  @Post('forgot-password/reset')
  @HttpCode(200)
  async reset(@Body() body: { resetSessionToken?: string; newPassword?: string; confirmPassword?: string }) {
    const userId = await this.codes.resetSessionUser(body.resetSessionToken, ADMIN_AUDIENCE)
    const user = userId ? await this.accounts.byId(userId) : null
    if (!user) throw apiError(400, 'ERR_RESET_SESSION_INVALID', 'Reset session expired')
    if (body.confirmPassword !== undefined && body.confirmPassword !== body.newPassword) {
      throw apiError(400, 'ERR_PASSWORD_MISMATCH', 'Passwords do not match')
    }
    if (!meetsPasswordPolicy(body.newPassword)) {
      throw apiError(400, 'ERR_INVALID_PASSWORD', 'Password does not meet the policy')
    }
    await this.codes.closeResetSession(body.resetSessionToken as string)
    await this.accounts.setPasswordHash(user.id, hashPassword(body.newPassword))
    await this.accounts.recordSuccess(user)
    await this.tokens.revokeUser(user.id)
    return {}
  }
}
