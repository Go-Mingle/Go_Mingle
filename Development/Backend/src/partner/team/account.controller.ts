import { Controller, Get, Patch, UseGuards } from '@nestjs/common'
import { apiError } from '../../common/errors'
import { Body } from '../../common/http'
import { CurrentPartner, PartnerGuard } from '../access/partner.guard'
import { PartnerAccountsService, type PartnerUser } from '../access/partner-accounts.service'

const NAME_MAX = 100
const DESIGNATION_MAX = 100

/** Email is the sign-in name and cannot be changed here. */
const profile = (u: PartnerUser, designation: string | null = u.designation) => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  designation,
  isPrimary: u.isPrimary,
  emailEditable: false,
})

/** My Account, for whoever is signed in (owner or team member): /partner/api/v1/partner/me */
@Controller('partner/api/v1/partner/me')
@UseGuards(PartnerGuard)
export class AccountController {
  constructor(private readonly accounts: PartnerAccountsService) {}

  @Get()
  me(@CurrentPartner() user: PartnerUser) {
    return { success: true, data: profile(user) }
  }

  /** The new name shows on the Team screen straight away: it is the same record. */
  @Patch()
  async update(@CurrentPartner() user: PartnerUser, @Body() body: Record<string, unknown>) {
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    if (!fullName || fullName.length > NAME_MAX) throw apiError(422, 'ERR_VALIDATION', 'Full name is required.')
    if (typeof body.designation === 'string' && body.designation.length > DESIGNATION_MAX) {
      throw apiError(422, 'ERR_VALIDATION', 'Designation must be 100 characters or fewer.')
    }
    // Leaving designation out keeps it; '' clears it.
    const designation = typeof body.designation === 'string' ? body.designation.trim() : user.designation
    const updated = await this.accounts.update(user.id, { fullName, designation })
    return { success: true, data: profile(updated, updated.designation || null) }
  }
}
