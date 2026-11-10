import { Controller, Get, UseGuards } from '@nestjs/common'
import { EscrowService } from '../shared/payments/escrow.service'
import { AdminGuard } from './access/admin.guard'
import { AdminRestaurantsService } from './restaurants/admin-restaurants.service'

const DAY = 86_400_000
const round = (n: number) => Math.round(n * 100) / 100

/** `+12%`, `-4%`, `0%`: this period against the one before it. */
function trend(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%'
  const pct = Math.round(((current - previous) / previous) * 100)
  return `${pct > 0 ? '+' : ''}${pct}%`
}

/**
 * Dashboard figures, computed from what is in the database:
 * /admin/api/dashboard/{stats,revenue-chart,bookings-chart}
 *
 * Revenue is GoMingle's fee on payouts released from escrow, split into its
 * fee on dinners (commissions) and on no-show penalties. Trends compare the last 30 days with
 * the 30 before.
 */
@Controller('admin/api/dashboard')
@UseGuards(AdminGuard)
export class DashboardController {
  constructor(
    private readonly directory: AdminRestaurantsService,
    private readonly escrow: EscrowService,
  ) {}

  private async fees() {
    const released = (await this.escrow.list({ status: 'RELEASED' })).map((h) => ({
      fee: h.platformFee,
      penalty: 'kind' in h && h.kind === 'NO_SHOW_HOLD',
      at: Date.parse(h.payout?.paidAt ?? h.updatedAt),
    }))
    const now = Date.now()
    const sum = (rows: typeof released) => round(rows.reduce((t, r) => t + r.fee, 0))
    const within = (from: number, to: number) => sum(released.filter((r) => r.at > now - from * DAY && r.at <= now - to * DAY))
    return {
      total: sum(released),
      // GoMingle's fee on no-show penalties, against its fee on dinners.
      penalties: sum(released.filter((r) => r.penalty)),
      last30: within(30, 0),
      previous30: within(60, 30),
    }
  }

  @Get('stats')
  async stats() {
    const restaurants = await this.directory.all()
    const pending = restaurants.filter((r) => r.status === 'PENDING')
    const oldest = Math.min(...pending.map((r) => Date.parse(`${r.submitted}T00:00:00Z`)).filter(Number.isFinite))
    const fees = await this.fees()
    return {
      activeRestaurants: restaurants.filter((r) => r.status === 'ACTIVE' && !r.suspended).length,
      pendingApprovals: pending.length,
      // Minglers sign up in the Mingler app, which is not built yet.
      activeMinglers: 0,
      earnings: fees.total,
      oldestPendingDays: pending.length && Number.isFinite(oldest) ? Math.max(0, Math.floor((Date.now() - oldest) / DAY)) : 0,
      trendRestaurants: '0%',
      trendMinglers: '0%',
      trendEarnings: trend(fees.last30, fees.previous30),
    }
  }

  @Get('revenue-chart')
  async revenue() {
    const fees = await this.fees()
    const penalties = fees.penalties
    const commissions = round(fees.total - penalties)
    const total = round(commissions + penalties)
    return {
      total,
      commissions,
      penalties,
      commissionPct: total ? Math.round((commissions / total) * 100) : 0,
      penaltyPct: total ? Math.round((penalties / total) * 100) : 0,
      trend: trend(fees.last30, fees.previous30),
    }
  }

  /** Bookings per day; filled once bookings exist. */
  @Get('bookings-chart')
  bookingsChart() {
    return []
  }
}
