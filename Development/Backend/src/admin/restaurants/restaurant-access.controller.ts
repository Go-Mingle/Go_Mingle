import { Controller, Delete, Get, HttpCode, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common'
import { apiError } from '../../common/errors'
import { Body } from '../../common/http'
import { OwnerAccessService } from '../../shared/accounts/owner-access.service'
import { AuditInterceptor } from '../../shared/changelog/audit.interceptor'
import { RestaurantsService } from '../../shared/restaurants/restaurants.service'
import { AdminGuard, CurrentAdmin } from '../access/admin.guard'
import type { AdminSession } from '../access/admin-accounts.service'

const notFound = () => apiError(404, 'ERR_RESTAURANT_NOT_FOUND', 'Restaurant not found.')

/**
 * Restaurant profiles created by GoMingle, and who can sign in to a restaurant:
 * /admin/api/v1/restaurants
 *
 * An admin creates a profile with the restaurant's name and its owner. The
 * owner is emailed, signs up with that email (or continues with Google), adds
 * the rest and sends the profile for approval through the usual queue.
 */
@Controller('admin/api/v1/restaurants')
@UseGuards(AdminGuard)
@UseInterceptors(AuditInterceptor)
export class RestaurantAccessController {
  constructor(
    private readonly access: OwnerAccessService,
    private readonly restaurants: RestaurantsService,
  ) {}

  @Post()
  @HttpCode(201)
  async create(@CurrentAdmin() admin: AdminSession, @Body() body: Record<string, unknown>) {
    return { success: true, data: await this.access.createProfile(admin.fullName, body) }
  }

  /** Profiles waiting for their owner to complete and submit them. */
  @Get('invited')
  async invited() {
    return { success: true, data: { items: await this.access.invitedList() } }
  }

  @Post('invited/:id/resend')
  @HttpCode(200)
  async resend(@Param('id') id: string) {
    const r = await this.access.invitedOne(id)
    if (!r) throw notFound()
    return { success: true, data: { id: r.id, name: r.name, ...(await this.access.resend(r)) } }
  }

  @Delete('invited/:id')
  async cancel(@Param('id') id: string) {
    const r = await this.access.invitedOne(id)
    if (!r) throw notFound()
    return { success: true, data: { name: r.name, ...(await this.access.cancel(r)) } }
  }

  /** Sign-in accounts of a restaurant GoMingle knows (submitted, or created by an admin). */
  @Get(':id/logins')
  async logins(@Param('id') id: string) {
    const r = await this.known(id)
    return { success: true, data: { items: await this.access.logins(r.id) } }
  }

  @Post(':id/logins')
  @HttpCode(201)
  async grant(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const r = await this.known(id)
    return { success: true, data: { name: r.name, ...(await this.access.grant(r, body)) } }
  }

  private async known(id: string) {
    const r = await this.restaurants.find(id)
    if (!r || (r.firstSubmittedAt === null && r.invitedAt === null)) throw notFound()
    return r
  }
}
