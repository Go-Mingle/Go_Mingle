import { Controller, HttpCode, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { apiError } from '../../common/errors'
import { Body } from '../../common/http'
import { CodesService } from '../../auth/codes.service'
import { checkPassword, meetsPasswordPolicy } from '../../auth/passwords'
import { bearer, PARTNER_AUDIENCE, TokensService } from '../../auth/tokens.service'
import { PartnerAccountsService, type PartnerUser } from './partner-accounts.service'
import { resolvePartner } from './partner.guard'
import { config } from '../../config'
import { verifyGoogleCredential } from '../../auth/google'
import { AccountDirectory } from '../../shared/accounts/account-directory.service'
import { newRestaurantId, routeFor, RestaurantsService } from '../../shared/restaurants/restaurants.service'

function lockMessage(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / 60_000))
  return `Your account is temporarily locked. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}

const identity = (user: PartnerUser) => ({ id: user.id, email: user.email, fullName: user.fullName })

/** Partner Portal authentication: /partner/api/v1/partner/auth/* */
@Controller('partner/api/v1/partner/auth')
export class PartnerAuthController {
  constructor(
    private readonly accounts: PartnerAccountsService,
    private readonly tokens: TokensService,
    private readonly codes: CodesService,
    private readonly restaurants: RestaurantsService,
    private readonly directory: AccountDirectory,
  ) {}

  issue(user: PartnerUser) {
    return this.tokens.issue({ id: user.id, email: user.email, fullName: user.fullName, roleName: 'partner' }, PARTNER_AUDIENCE)
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email?: string; password?: string }) {
    const user = await this.accounts.byEmail(body.email)
    const locked = this.accounts.lockRemainingMs(user)
    if (locked) throw apiError(403, 'PRE_AUTH_REJECTED', lockMessage(locked))
    if (!user || !checkPassword(user.passwordHash, body.password)) {
      const remaining = await this.accounts.recordFailure(user)
      if (user && remaining === 0) {
        throw apiError(403, 'PRE_AUTH_REJECTED', lockMessage(this.accounts.lockRemainingMs(await this.accounts.byId(user.id))))
      }
      throw apiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password')
    }
    if (user.status !== 'ACTIVE') throw apiError(403, 'PRE_AUTH_REJECTED', 'This account is suspended. Contact GoMingle support.')
    await this.accounts.recordSuccess(user)
    return { ...(await this.issue(user)), user: identity(user) }
  }

  /**
   * Sign in, or sign up, with Google. The body carries the ID token Google
   * Identity Services gave the portal (`credential`). A partner with that email
   * is signed in; an unknown email gets a new partner account with its Draft
   * restaurant, like a completed email sign-up (Google has verified the email).
   */
  @Post('google')
  @HttpCode(200)
  async google(@Body() body: { credential?: unknown }) {
    if (!config.googleClientId) throw apiError(503, 'GOOGLE_SIGN_IN_OFF', 'Sign in with Google is not available right now.')
    const check = await verifyGoogleCredential(body.credential, config.googleClientId).catch(() => null)
    if (!check) throw apiError(503, 'GOOGLE_UNAVAILABLE', 'Google could not be reached. Try again in a moment.')
    if (!check.ok) throw apiError(401, 'GOOGLE_TOKEN_INVALID', 'Google sign-in could not be verified. Try again.')
    const { email, name, sub } = check.identity

    let user = await this.accounts.byEmail(email)
    let isNew = false
    if (user) {
      if (user.googleSub && user.googleSub !== sub) throw apiError(401, 'GOOGLE_TOKEN_INVALID', 'Google sign-in could not be verified. Try again.')
      const locked = this.accounts.lockRemainingMs(user)
      if (locked) throw apiError(403, 'PRE_AUTH_REJECTED', lockMessage(locked))
      if (user.status !== 'ACTIVE') throw apiError(403, 'PRE_AUTH_REJECTED', 'This account is suspended. Contact GoMingle support.')
      if (!user.googleSub) user = await this.accounts.update(user.id, { googleSub: sub })
      await this.accounts.recordSuccess(user)
    } else {
      if (await this.directory.emailInUse(email)) {
        throw apiError(409, 'ERR_ALREADY_REGISTERED', 'This email is used by a GoMingle Admin account and cannot be used for a partner account.')
      }
      user = await this.accounts.create({ email, fullName: name, restaurantId: newRestaurantId(), isPrimary: true })
      user = await this.accounts.update(user.id, { googleSub: sub })
      isNew = true
    }
    const restaurant = await this.restaurants.ensure(user.restaurantId)
    return { ...(await this.issue(user)), user: identity(user), isNew, route: routeFor(restaurant.status) }
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: { refreshToken?: string }) {
    const userId = await this.tokens.consume(body.refreshToken, PARTNER_AUDIENCE)
    const user = userId ? await this.accounts.byId(userId) : null
    if (!user || user.status !== 'ACTIVE') throw apiError(401, 'REFRESH_FAILED', 'Session expired')
    return { ...(await this.issue(user)), user: identity(user) }
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const { claims } = this.tokens.verify(bearer(req), PARTNER_AUDIENCE)
    if (claims) await this.tokens.revokeUser(claims.sub)
    res.status(204).end()
  }

  @Post('forgot-password')
  async forgot(@Body() body: { email?: string }, @Res() res: Response) {
    const user = await this.accounts.byEmail(body.email)
    if (user) await this.codes.issue('partner-reset', user.email, 10, user.fullName)
    res.status(204).end()
  }

  @Post('confirm-forgot-password')
  async confirmForgot(@Body() body: { email?: string; code?: unknown; newPassword?: string }, @Res() res: Response) {
    const user = await this.accounts.byEmail(body.email)
    const result = await this.codes.check('partner-reset', String(body.email ?? ''), String(body.code ?? ''))
    if (!user || result === 'expired') throw apiError(400, 'CODE_EXPIRED', 'Code expired')
    if (result === 'mismatch') throw apiError(400, 'CODE_MISMATCH', 'Incorrect code')
    if (!meetsPasswordPolicy(body.newPassword)) throw apiError(400, 'INVALID_PASSWORD', 'Weak password')
    await this.codes.clear('partner-reset', String(body.email))
    await this.accounts.setPassword(user.id, body.newPassword)
    await this.accounts.recordSuccess(user)
    await this.tokens.revokeUser(user.id)
    res.status(204).end()
  }

  @Post('change-password')
  async changePassword(@Req() req: Request, @Body() body: { currentPassword?: string; newPassword?: string }, @Res() res: Response) {
    const user = await resolvePartner(req, this.tokens, this.accounts)
    if (!checkPassword(user.passwordHash, body.currentPassword)) throw apiError(400, 'INVALID_CREDENTIALS', 'Current password is incorrect')
    if (body.newPassword === body.currentPassword) throw apiError(400, 'SAME_PASSWORD', 'Same password')
    if (!meetsPasswordPolicy(body.newPassword)) throw apiError(400, 'INVALID_PASSWORD', 'Weak password')
    await this.accounts.setPassword(user.id, body.newPassword)
    res.status(204).end()
  }
}
