import { Controller, Get, Inject, Patch, UseGuards, UseInterceptors } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { settings } from '../../db/schema'
import { Body } from '../../common/http'
import { AuditInterceptor } from '../../shared/changelog/audit.interceptor'
import { AdminGuard, CurrentAdmin } from '../access/admin.guard'
import type { AdminSession } from '../access/admin-accounts.service'

const KEY = 'loyalty'

export const DEFAULT_LOYALTY = {
  pkrSpentToEarn1Point: 10,
  bonusPointsAt10thBooking: 100,
  pointsPerAcceptedInvite: 50,
  pointsPerReviewWithPhoto: 25,
  pointsPerCrownProminglerRole: 75,
  pointsPerInterestTableShare: 15,
  pointsNeededForPkr1Off: 100,
  maxRedemptionPercentOfBill: 50,
  earnUpdatedAt: null,
  earnUpdatedBy: null,
  redeemUpdatedAt: null,
  redeemUpdatedBy: null,
}

/** Loyalty configuration: /admin/api/v1/loyalty-configuration */
@Controller('admin/api/v1/loyalty-configuration')
@UseGuards(AdminGuard)
@UseInterceptors(AuditInterceptor)
export class LoyaltyController {
  constructor(@Inject(DB) private readonly db: Db) {}

  private async read(): Promise<Record<string, unknown>> {
    const [row] = await this.db.select().from(settings).where(eq(settings.key, KEY))
    return { ...DEFAULT_LOYALTY, ...(row?.value ?? {}) }
  }

  private async write(changes: Record<string, unknown>) {
    const value = { ...(await this.read()), ...changes }
    await this.db.insert(settings).values({ key: KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } })
    return { success: true, data: value }
  }

  @Get()
  async get() {
    return { success: true, data: await this.read() }
  }

  @Patch('earn-rate')
  earn(@Body() body: Record<string, unknown>, @CurrentAdmin() me: AdminSession) {
    return this.write({ ...body, earnUpdatedAt: new Date().toISOString(), earnUpdatedBy: { id: me.id, name: me.fullName } })
  }

  @Patch('redeem-rate')
  redeem(@Body() body: Record<string, unknown>, @CurrentAdmin() me: AdminSession) {
    return this.write({ ...body, redeemUpdatedAt: new Date().toISOString(), redeemUpdatedBy: { id: me.id, name: me.fullName } })
  }
}
