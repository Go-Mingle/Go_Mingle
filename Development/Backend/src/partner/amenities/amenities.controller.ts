import { Controller, Get, Inject, Param, Put, UseGuards } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { config } from '../../config'
import { DB, type Db } from '../../db/database'
import { amenities } from '../../db/schema'
import { apiError } from '../../common/errors'
import { Body } from '../../common/http'
import { RestaurantsService } from '../../shared/restaurants/restaurants.service'
import { CurrentPartner, PartnerGuard } from '../access/partner.guard'
import type { PartnerUser } from '../access/partner-accounts.service'
import { readOnly } from '../profile/profile.service'

/**
 * The amenities a restaurant offers, ticked from GoMingle's catalogue:
 * /partner/api/v1/partner/restaurant/amenities
 */
@Controller('partner/api/v1/partner/restaurant/amenities')
@UseGuards(PartnerGuard)
export class PartnerAmenitiesController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly restaurants: RestaurantsService,
  ) {}

  @Get()
  async list(@CurrentPartner() user: PartnerUser) {
    const r = await this.restaurants.ensure(user.restaurantId)
    const items = (await this.db.select().from(amenities))
      .map((a) => ({
        amenityId: a.id,
        name: a.name,
        iconUrl: `${config.publicUrl}/amenity-icons/${encodeURIComponent(a.id)}.svg`,
        selected: r.amenityIds.includes(a.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return { success: true, data: { items } }
  }

  @Put(':amenityId')
  async set(@CurrentPartner() user: PartnerUser, @Param('amenityId') amenityId: string, @Body() body: { selected?: unknown }) {
    const r = await this.restaurants.ensure(user.restaurantId)
    if (r.status === 'PENDING') throw readOnly()
    if (typeof body.selected !== 'boolean') throw apiError(422, 'ERR_VALIDATION', 'Invalid request.')
    const [amenity] = await this.db.select().from(amenities).where(eq(amenities.id, amenityId))
    if (!amenity) throw apiError(404, 'ERR_NOT_FOUND', 'Amenity not found.')
    const ids = new Set(r.amenityIds)
    if (body.selected) ids.add(amenityId)
    else ids.delete(amenityId)
    await this.restaurants.update(r.id, { amenityIds: [...ids] })
    return { success: true, data: { amenityId, selected: body.selected } }
  }
}
