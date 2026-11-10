import { Controller, Get, Put, UseGuards } from '@nestjs/common'
import { apiError } from '../common/errors'
import { Body } from '../common/http'
import { RestaurantsService, type Restaurant } from '../shared/restaurants/restaurants.service'
import { CurrentPartner, PartnerGuard } from './access/partner.guard'
import type { PartnerUser } from './access/partner-accounts.service'

export const PENALTY_MAX_PKR = 100_000
export const WINDOW_MAX_HOURS = 168

const view = (r: Restaurant) => ({
  penaltyPerSeatPkr: r.noShowPenaltyPerSeatPkr,
  cancellationWindowHours: r.cancellationWindowHours,
  limits: { penaltyMaxPkr: PENALTY_MAX_PKR, windowMaxHours: WINDOW_MAX_HOURS },
})

/**
 * The restaurant's no-show policy (GM-204):
 * /partner/api/v1/partner/restaurant/no-show-policy
 *
 * A penalty of 0 is a valid policy: no card hold, no charge. A change applies
 * to bookings made from then on; existing bookings keep the policy they were
 * made under. Editable in every state, like the payout account.
 */
@Controller('partner/api/v1/partner/restaurant/no-show-policy')
@UseGuards(PartnerGuard)
export class NoShowPolicyController {
  constructor(private readonly restaurants: RestaurantsService) {}

  @Get()
  async get(@CurrentPartner() user: PartnerUser) {
    return { success: true, data: view(await this.restaurants.ensure(user.restaurantId)) }
  }

  @Put()
  async put(@CurrentPartner() user: PartnerUser, @Body() body: Record<string, unknown>) {
    const r = await this.restaurants.ensure(user.restaurantId)
    const fields: Record<string, string> = {}
    const penalty = body.penaltyPerSeatPkr
    const hours = body.cancellationWindowHours
    if (typeof penalty !== 'number' || !Number.isFinite(penalty) || penalty < 0) fields.penaltyPerSeatPkr = 'Enter an amount of 0 or more.'
    else if (penalty > PENALTY_MAX_PKR) fields.penaltyPerSeatPkr = `The penalty can be at most PKR ${PENALTY_MAX_PKR.toLocaleString('en-PK')} per seat.`
    if (typeof hours !== 'number' || !Number.isInteger(hours) || hours < 0) fields.cancellationWindowHours = 'Enter a whole number of hours, 0 or more.'
    else if (hours > WINDOW_MAX_HOURS) fields.cancellationWindowHours = `The cancellation window can be at most ${WINDOW_MAX_HOURS} hours.`
    if (Object.keys(fields).length) throw apiError(422, 'ERR_VALIDATION', 'Please correct the highlighted fields.', { fields })
    const updated = await this.restaurants.update(r.id, {
      noShowPenaltyPerSeatPkr: Math.round((penalty as number) * 100) / 100,
      cancellationWindowHours: hours as number,
    })
    return { success: true, data: view(updated) }
  }
}
