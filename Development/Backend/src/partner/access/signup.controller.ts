import { Controller, HttpCode, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { apiError } from '../../common/errors'
import { Body } from '../../common/http'
import { CodesService } from '../../auth/codes.service'
import { meetsPasswordPolicy, normaliseEmail } from '../../auth/passwords'
import { PARTNER_AUDIENCE, TokensService } from '../../auth/tokens.service'
import { AccountDirectory } from '../../shared/accounts/account-directory.service'
import { newRestaurantId, RestaurantsService } from '../../shared/restaurants/restaurants.service'
import { PartnerAccountsService } from './partner-accounts.service'
import { resolvePartner } from './partner.guard'

const PURPOSE = 'partner-signup'
/** Signing up with this address shows the "too many attempts" recovery (demo). */
const THROTTLED_EMAIL = 'throttled@gomingle.com'

const codeSent = () => ({ success: true, data: { codeSent: true } })
const alreadyRegistered = () => apiError(409, 'ERR_ALREADY_REGISTERED', 'This account already exists. Please sign in.')

/**
 * Partner sign-up: /partner/api/v1/partner/signup/*
 * start → emailed code → verify (creates the account and its Draft restaurant,
 * signs in) → complete (sets the password).
 */
@Controller('partner/api/v1/partner/signup')
export class SignupController {
  constructor(
    private readonly accounts: PartnerAccountsService,
    private readonly restaurants: RestaurantsService,
    private readonly directory: AccountDirectory,
    private readonly tokens: TokensService,
    private readonly codes: CodesService,
  ) {}

  @Post('start')
  @HttpCode(200)
  async start(@Body() body: { email?: string }) {
    const email = normaliseEmail(body.email)
    if ((await this.accounts.byEmail(email))?.passwordHash) throw alreadyRegistered()
    if (email === THROTTLED_EMAIL) throw apiError(429, 'ERR_TOO_MANY_REQUESTS', 'Too many attempts. Please try again later.')
    if (email) await this.codes.issue(PURPOSE, email)
    return codeSent()
  }

  @Post('resend')
  @HttpCode(200)
  async resend(@Body() body: { email?: string }) {
    const email = normaliseEmail(body.email)
    if (email) await this.codes.issue(PURPOSE, email)
    return codeSent()
  }

  @Post('verify')
  @HttpCode(201)
  async verify(@Body() body: { email?: string; code?: unknown }) {
    const email = normaliseEmail(body.email)
    if ((await this.codes.check(PURPOSE, email, String(body.code ?? ''))) !== 'ok') {
      throw apiError(422, 'ERR_VALIDATION', 'That code is incorrect. Check it and try again.')
    }
    let user = await this.accounts.byEmail(email)
    // An account that already has a password signs in instead; an email used by an admin cannot sign up.
    if (user?.passwordHash || (!user && (await this.directory.emailInUse(email)))) throw alreadyRegistered()
    await this.codes.clear(PURPOSE, email)
    user ??= await this.accounts.create({ email, fullName: email.split('@')[0], restaurantId: newRestaurantId(), isPrimary: true })
    const restaurant = await this.restaurants.ensure(user.restaurantId)
    const session = await this.tokens.issue({ id: user.id, email: user.email, fullName: user.fullName, roleName: 'partner' }, PARTNER_AUDIENCE)
    return {
      success: true,
      data: {
        partnerUser: { id: user.id, email, isPrimary: true },
        restaurant: { id: restaurant.id, status: restaurant.status },
        route: 'PROFILE_SETUP',
        session: { ...session, idToken: session.accessToken },
      },
    }
  }

  /** Authenticated by the token `verify` issued; only sets the password (and name). */
  @Post('complete')
  @HttpCode(200)
  async complete(@Req() req: Request, @Body() body: { password?: string; fullName?: string }) {
    const user = await resolvePartner(req, this.tokens, this.accounts)
    if (!meetsPasswordPolicy(body.password)) throw apiError(422, 'ERR_VALIDATION', 'Password does not meet the policy')
    await this.accounts.setPassword(user.id, body.password)
    if (body.fullName) await this.accounts.update(user.id, { fullName: String(body.fullName).trim() })
    return { success: true, data: { passwordSet: true } }
  }
}
