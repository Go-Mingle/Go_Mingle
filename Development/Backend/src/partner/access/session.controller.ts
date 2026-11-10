import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common'
import { routeFor, RestaurantsService } from '../../shared/restaurants/restaurants.service'
import { CurrentPartner, PartnerGuard } from './partner.guard'
import { PartnerAccountsService, type PartnerUser } from './partner-accounts.service'

/** Who is signed in and where the portal should take them: /partner/api/v1/partner/session */
@Controller('partner/api/v1/partner/session')
@UseGuards(PartnerGuard)
export class SessionController {
  constructor(
    private readonly restaurants: RestaurantsService,
    private readonly accounts: PartnerAccountsService,
  ) {}

  @Get()
  async session(@CurrentPartner() user: PartnerUser) {
    const r = await this.restaurants.ensure(user.restaurantId)
    return {
      success: true,
      data: {
        partnerUser: { id: user.id, fullName: user.fullName, email: user.email, designation: user.designation, isPrimary: user.isPrimary },
        restaurant: { id: r.id, name: r.name ?? '', status: r.status, payoutReady: Boolean(r.payoutAccountId), coverImageUrl: null },
        route: routeFor(r.status),
      },
    }
  }

  /** Stamps the sign-in on the team list. */
  @Post('login-recorded')
  @HttpCode(200)
  async loginRecorded(@CurrentPartner() user: PartnerUser) {
    const lastActiveAt = new Date().toISOString()
    await this.accounts.update(user.id, { lastActiveAt })
    return { success: true, data: { lastActiveAt } }
  }
}
