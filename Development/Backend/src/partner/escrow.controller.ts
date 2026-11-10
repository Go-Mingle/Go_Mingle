import { Controller, Get, UseGuards } from '@nestjs/common'
import { EscrowService } from '../shared/payments/escrow.service'
import { maskIban, PayoutService } from '../shared/payments/payout.service'
import { SafepayService } from '../shared/payments/safepay.service'
import { CurrentPartner, PartnerGuard } from './access/partner.guard'
import type { PartnerUser } from './access/partner-accounts.service'

/** The restaurant's money in escrow and its payouts: /partner/api/v1/partner/escrow */
@Controller('partner/api/v1/partner/escrow')
@UseGuards(PartnerGuard)
export class PartnerEscrowController {
  constructor(
    private readonly escrow: EscrowService,
    private readonly safepay: SafepayService,
    private readonly payouts: PayoutService,
  ) {}

  @Get()
  async get(@CurrentPartner() user: PartnerUser) {
    const account = await this.payouts.account(user.restaurantId)
    return {
      success: true,
      data: {
        gateway: this.safepay.gateway,
        summary: await this.escrow.summary(user.restaurantId),
        payoutAccount: account ? { accountTitle: account.accountTitle, bankName: account.bankName, iban: maskIban(account.iban) } : null,
        items: await this.escrow.list({ restaurantId: user.restaurantId }),
      },
    }
  }
}
