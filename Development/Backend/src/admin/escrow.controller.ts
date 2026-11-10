import { Controller, Get, HttpCode, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common'
import { apiError } from '../common/errors'
import { Body, Query } from '../common/http'
import { AuditInterceptor } from '../shared/changelog/audit.interceptor'
import { NotificationsService } from '../shared/notifications/notifications.service'
import { EscrowService } from '../shared/payments/escrow.service'
import { PayoutService } from '../shared/payments/payout.service'
import { GatewayError, SafepayService } from '../shared/payments/safepay.service'
import { AdminGuard, CurrentAdmin } from './access/admin.guard'
import type { AdminSession } from './access/admin-accounts.service'
import { AdminRestaurantsService } from './restaurants/admin-restaurants.service'

type Json = Record<string, unknown>
const fmtPkr = (n: number) => `PKR ${Number(n).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`

/** A Safepay failure reaches the screen as 502 with Safepay's own message. */
async function gateway<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (err) {
    if (err instanceof GatewayError) throw apiError(502, 'ERR_GATEWAY', `Safepay: ${err.message}`)
    throw err
  }
}

/** The escrow console: Safepay holds, the escrow balance, releases and refunds. /admin/api/v1/escrow */
@Controller('admin/api/v1/escrow')
@UseGuards(AdminGuard)
@UseInterceptors(AuditInterceptor)
export class EscrowController {
  constructor(
    private readonly escrow: EscrowService,
    private readonly safepay: SafepayService,
    private readonly payouts: PayoutService,
    private readonly directory: AdminRestaurantsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  async console(@Query() q: Record<string, string>) {
    const failures = await this.escrow.openFailures()
    const live = (await this.directory.all()).filter((r) => r.status === 'ACTIVE' && !r.suspended)
    return {
      success: true,
      data: {
        gateway: this.safepay.gateway,
        summary: await this.escrow.summary(),
        items: await this.escrow.list({ status: q.status || undefined }),
        // Gateway operations that failed and wait for a person. Only present when there are any.
        ...(failures.length ? { paymentFailures: failures } : {}),
        restaurants: await Promise.all(
          live.map(async (r) => ({ id: r.id, name: r.name ?? '', hasPayoutAccount: Boolean(await this.payouts.account(r.id)) })),
        ),
      },
    }
  }

  /** A sandbox booking, so the flow can be tried before the Mingler app exists. */
  @Post('test-booking')
  @HttpCode(201)
  async testBooking(@Body() body: Json, @CurrentAdmin() admin: AdminSession) {
    if (!(await this.directory.known(String(body.restaurantId ?? '')))) throw apiError(422, 'ERR_VALIDATION', 'Choose a restaurant.')
    const item = await gateway(() =>
      this.escrow.createHold({
        restaurantId: String(body.restaurantId),
        minglerName: String(body.minglerName ?? '').trim() || 'Test Mingler',
        guests: body.guests ?? 2,
        amountPerGuest: body.amountPerGuest ?? 3000,
        eventName: body.eventName,
        by: `${admin.fullName} (sandbox test booking)`,
      }),
    )
    return { success: true, data: item }
  }

  @Post(':id/:action')
  @HttpCode(200)
  async act(@Param('id') id: string, @Param('action') action: string, @Body() body: Json, @CurrentAdmin() admin: AdminSession) {
    if (!['capture', 'void', 'release', 'refund'].includes(action)) throw apiError(404, 'ERR_NOT_FOUND', 'Unknown escrow route.')
    const by = admin.fullName
    const reason = String(body.reason ?? '').trim() || undefined
    const item = await gateway(() =>
      action === 'capture'
        ? this.escrow.capture(id, by)
        : action === 'void'
          ? this.escrow.void(id, by, reason)
          : action === 'refund'
            ? this.escrow.refund(id, by, reason)
            : this.escrow.release(id, by),
    )
    if (action === 'capture') {
      await this.notifications.notifyPartner(item.restaurantId, {
        type: 'ESCROW_FUNDED',
        title: 'Payment held in escrow',
        body: `${fmtPkr(item.amount)} for ${item.eventName} (${item.bookingRef}) is held in Safepay escrow until the event is completed.`,
        deepLink: '/finances',
        metadata: { escrowId: id },
      })
    }
    if (action === 'release' && item.payout) {
      await this.notifications.notifyPartner(item.restaurantId, {
        type: 'PAYOUT_RELEASED',
        title: 'Payout released',
        body: `${fmtPkr(item.payout.amount)} for ${item.bookingRef} was released from escrow to ${item.payout.bank} ${item.payout.ibanMasked} (GoMingle fee ${fmtPkr(item.payout.platformFee)}).`,
        deepLink: '/finances',
        metadata: { escrowId: id, reference: item.payout.reference },
      })
    }
    return { success: true, data: item }
  }
}
