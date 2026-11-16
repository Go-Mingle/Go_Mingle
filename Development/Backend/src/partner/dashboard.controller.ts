import { Controller, Get, UseGuards } from '@nestjs/common'
import { Query } from '../common/http'
import { InsightsService } from '../shared/insights/insights.service'
import { CurrentPartner, PartnerGuard } from './access/partner.guard'
import type { PartnerUser } from './access/partner-accounts.service'

/**
 * The restaurant's own dashboard: /partner/api/v1/partner/dashboard?days=7|30|90
 * Bookings, seats and money per day, how bookings turned out, and how full the
 * upcoming interest tables are.
 */
@Controller('partner/api/v1/partner/dashboard')
@UseGuards(PartnerGuard)
export class PartnerDashboardController {
  constructor(private readonly insights: InsightsService) {}

  @Get()
  async overview(@CurrentPartner() me: PartnerUser, @Query() q: Record<string, string>) {
    // A restaurant sees its own figures only; other restaurants are never listed.
    const { topRestaurants: _platformOnly, ...mine } = await this.insights.overview({ restaurantId: me.restaurantId, days: Number(q.days) })
    void _platformOnly
    return { success: true, data: mine }
  }
}
