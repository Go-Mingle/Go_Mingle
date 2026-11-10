import { Controller, Get, UseGuards } from '@nestjs/common'
import { rawError } from '../common/errors'
import { PartnerGuard } from './access/partner.guard'

/**
 * Two early routes the Overview screen still asks for. There is nothing
 * behind them (the screen falls back to the session and profile), so they
 * answer as they always have: an empty list and "not found".
 */
@Controller('partner/api')
@UseGuards(PartnerGuard)
export class PartnerLegacyController {
  @Get('restaurants')
  restaurants() {
    return []
  }

  @Get('restaurants/:id')
  restaurant() {
    throw rawError(404, { message: 'Not found' })
  }

  @Get('minglers/:id')
  mingler() {
    throw rawError(404, { message: 'Not found' })
  }
}
