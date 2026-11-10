import { Controller, Get, Put, UseGuards } from '@nestjs/common'
import { apiError } from '../../common/errors'
import { Body } from '../../common/http'
import { BANKS, PayoutService, publicPayoutAccount } from '../../shared/payments/payout.service'
import { RestaurantsService } from '../../shared/restaurants/restaurants.service'
import { CurrentPartner, PartnerGuard } from '../access/partner.guard'
import type { PartnerUser } from '../access/partner-accounts.service'

/**
 * The restaurant's payout bank account (Payout Account tab):
 * /partner/api/v1/partner/restaurant/payout-account
 * Editable in every state: bank details are not part of the profile under
 * review, and escrow is released to whatever is on file.
 */
@Controller('partner/api/v1/partner/restaurant/payout-account')
@UseGuards(PartnerGuard)
export class PayoutAccountController {
  constructor(
    private readonly payouts: PayoutService,
    private readonly restaurants: RestaurantsService,
  ) {}

  @Get()
  async get(@CurrentPartner() user: PartnerUser) {
    const r = await this.restaurants.ensure(user.restaurantId)
    return { success: true, data: { account: publicPayoutAccount(await this.payouts.account(r.id)), banks: BANKS } }
  }

  @Put()
  async put(@CurrentPartner() user: PartnerUser, @Body() body: Record<string, unknown>) {
    const r = await this.restaurants.ensure(user.restaurantId)
    const result = await this.payouts.save(r.id, body)
    if (result.error !== undefined) throw apiError(422, 'ERR_VALIDATION', result.error, { field: result.field })
    return { success: true, data: { account: publicPayoutAccount(result.account), banks: BANKS } }
  }
}
