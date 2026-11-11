import { Controller, Get, HttpCode, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common'
import { apiError } from '../common/errors'
import { Body, Query } from '../common/http'
import { AuditInterceptor } from '../shared/changelog/audit.interceptor'
import { BookingsService } from '../shared/bookings/bookings.service'
import { NotificationsService } from '../shared/notifications/notifications.service'
import { EscrowService } from '../shared/payments/escrow.service'
import { PayoutService } from '../shared/payments/payout.service'
import { GatewayError, SafepayService } from '../shared/payments/safepay.service'
import { AdminGuard, CurrentAdmin } from './access/admin.guard'
import type { AdminSession } from './access/admin-accounts.service'
import { AdminRestaurantsService } from './restaurants/admin-restaurants.service'

type Json = Record<string, unknown>
const fmtPkr = (n: number) => `PKR ${Number(n).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`

/** The only card numbers the temporary admin card step accepts (GM-255). */
const TEST_CARDS: Record<string, { brand: string; declines?: boolean }> = {
  '4111111111111111': { brand: 'Visa' },
  '5555555555554444': { brand: 'Mastercard' },
  '4000000000000002': { brand: 'Visa', declines: true },
}
const spaced = (n: string) => n.replace(/(.{4})/g, '$1 ').trim()

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
    private readonly bookings: BookingsService,
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
        // Collections and releases that failed at the gateway and wait for a person.
        paymentFailures: failures,
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

  /**
   * TEMPORARY (GM-255, remove when the Mingler app takes the card): an admin
   * completes the card step of a sandbox booking with a test card.
   *
   * Only the published test numbers are accepted, so a real card can never be
   * used here. The number is checked and dropped: nothing but the brand and
   * last four digits is stored, and nothing is sent to Safepay.
   */
  @Post(':id/test-card')
  @HttpCode(200)
  async testCard(@Param('id') id: string, @Body() body: Json, @CurrentAdmin() admin: AdminSession) {
    const number = String(body.cardNumber ?? '').replace(/[\s-]/g, '')
    const month = Number(body.expMonth)
    const year = Number(body.expYear)
    const fields: Record<string, string> = {}
    const known = TEST_CARDS[number]
    if (!known) fields.cardNumber = `Only test cards are accepted here: ${Object.keys(TEST_CARDS).map(spaced).join(', ')}. Never enter a real card.`
    const now = new Date()
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < now.getFullYear() || year > now.getFullYear() + 20) {
      fields.expiry = 'Enter a valid expiry date.'
    } else if (year === now.getFullYear() && month < now.getMonth() + 1) {
      fields.expiry = 'This card has expired.'
    }
    if (!/^\d{3,4}$/.test(String(body.cvc ?? ''))) fields.cvc = 'Enter the 3 or 4 digit security code.'
    if (Object.keys(fields).length) throw apiError(422, 'ERR_VALIDATION', 'Please correct the highlighted fields.', { fields })
    if (known.declines) throw apiError(402, 'ERR_CARD_DECLINED', 'The card was declined. Try another test card.')
    const items = await this.escrow.addTestCard(id, { brand: known.brand, last4: number.slice(-4) }, `${admin.fullName} (test card)`)
    return { success: true, data: { items } }
  }

  /**
   * Opens Safepay's own checkout page for a hold that waits for a card, so the
   * payment really happens at Safepay (and shows there as paid). One payment
   * covers every waiting seat of the booking. The card is typed on Safepay's
   * page; GoMingle never sees it. Only available with Safepay keys set.
   */
  @Post(':id/checkout')
  @HttpCode(200)
  async checkout(@Param('id') id: string, @Body() body: Json, @CurrentAdmin() admin: AdminSession) {
    if (!this.safepay.isLive) {
      throw apiError(409, 'ERR_GATEWAY_NOT_CONFIGURED', 'Safepay keys are not set, so there is no Safepay checkout. Add a test card instead.')
    }
    const returnUrl = String(body.returnUrl ?? '')
    if (!/^https?:\/\/[^\s]+$/i.test(returnUrl)) throw apiError(422, 'ERR_VALIDATION', 'A return address is required.')
    return { success: true, data: await gateway(() => this.escrow.startCheckout(id, returnUrl, `${admin.fullName} (Safepay checkout)`)) }
  }

  /** Asks Safepay whether that checkout was paid; if so the holds are placed. */
  @Post(':id/checkout/confirm')
  @HttpCode(200)
  async confirmCheckout(@Param('id') id: string) {
    return { success: true, data: await gateway(() => this.escrow.confirmCheckout(id)) }
  }

  /** Tries a failed collection or release again. */
  @Post('failures/:failureId/retry')
  @HttpCode(200)
  async retryFailure(@Param('failureId') failureId: string, @CurrentAdmin() admin: AdminSession) {
    return { success: true, data: await this.bookings.retryFailure(Number(failureId), admin.fullName) }
  }

  /** Closes a failure that was settled another way; the note says how. */
  @Post('failures/:failureId/resolve')
  @HttpCode(200)
  async resolveFailure(@Param('failureId') failureId: string, @Body() body: Json, @CurrentAdmin() admin: AdminSession) {
    const note = String(body.note ?? '').trim()
    if (note.length < 5) throw apiError(422, 'ERR_VALIDATION', 'Add a short note on how this was settled.')
    const f = await this.escrow.failure(Number(failureId))
    // Nothing more will be collected on this hold, so it must not stay on the Mingler's card.
    if (f.action === 'capture' && f.holdId) {
      const holdId = f.holdId
      await gateway(() => this.escrow.releaseHold(holdId, admin.fullName, `Collection closed: ${note}`))
    }
    await this.escrow.resolveFailure(f.seq, admin.fullName, 'DISMISSED', note)
    return { success: true, data: { id: f.seq, resolved: true } }
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
