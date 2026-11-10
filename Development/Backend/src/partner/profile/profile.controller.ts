import { Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { and, eq } from 'drizzle-orm'
import { config } from '../../config'
import { DB, type Db } from '../../db/database'
import { restaurantContacts } from '../../db/schema'
import { apiError } from '../../common/errors'
import { Body, Query } from '../../common/http'
import { RestaurantsService, type Contact, type Restaurant } from '../../shared/restaurants/restaurants.service'
import { ReviewService } from '../../shared/restaurants/review.service'
import { CurrentPartner, PartnerGuard } from '../access/partner.guard'
import type { PartnerUser } from '../access/partner-accounts.service'
import { profileError, ProfileService, readOnly, type NestedPatch } from './profile.service'

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/
export const trustedOrigin = (origin: string | undefined) =>
  Boolean(origin) && (LOCAL_ORIGIN.test(origin as string) || config.corsOrigins.includes(origin as string))

const SORTABLE = ['name', 'title', 'email', 'phone']
const contactShape = (c: Contact) => ({ id: c.id, name: c.name, title: c.title, email: c.email, phone: c.phone })

/** The partner's restaurant profile: /partner/api/v1/partner/restaurant */
@Controller('partner/api/v1/partner/restaurant')
@UseGuards(PartnerGuard)
export class ProfileController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly restaurants: RestaurantsService,
    private readonly profile: ProfileService,
    private readonly review: ReviewService,
  ) {}

  private mine(user: PartnerUser): Promise<Restaurant> {
    return this.restaurants.ensure(user.restaurantId)
  }

  @Get()
  async get(@CurrentPartner() user: PartnerUser) {
    return { success: true, data: await this.profile.response(await this.mine(user)) }
  }

  @Patch()
  async patch(@CurrentPartner() user: PartnerUser, @Body() body: NestedPatch) {
    const r = await this.mine(user)
    // A suspended restaurant cannot put itself back on the Mingler app.
    if (body.visibleOnApp === true && r.status === 'ACTIVE' && r.suspended) {
      throw apiError(409, 'ERR_RESTAURANT_SUSPENDED', 'GoMingle has suspended your restaurant. Contact GoMingle to be reactivated.')
    }
    // Everything is refused while under review.
    if (r.status === 'PENDING') throw readOnly()
    // Validation first: a patch that is going to 422 must not flip visibility on its way out.
    this.profile.validate(body)
    const changes = this.profile.changes(body)
    if (body.visibleOnApp !== undefined) {
      if (r.status !== 'ACTIVE') throw profileError('ERR_VALIDATION', 'Visibility is only available once active.', 422)
      if (body.visibleOnApp && !r.mainPhotoKey) {
        throw profileError('ERR_COVER_PHOTO_REQUIRED', 'A cover photo is required before your restaurant is visible to Minglers.', 422)
      }
      changes.visibleOnApp = body.visibleOnApp
    }
    return this.save(r, changes)
  }

  @Post('save-draft')
  @HttpCode(200)
  async saveDraft(@CurrentPartner() user: PartnerUser, @Body() body: NestedPatch) {
    const r = await this.mine(user)
    if (r.status === 'PENDING') throw readOnly()
    this.profile.validate(body)
    return this.save(r, this.profile.changes(body))
  }

  private async save(r: Restaurant, changes: Partial<Restaurant>) {
    const updated = Object.keys(changes).length ? await this.restaurants.update(r.id, changes) : r
    return { success: true, data: await this.profile.response(updated) }
  }

  @Post('submit')
  @HttpCode(200)
  async submit(@CurrentPartner() user: PartnerUser) {
    const r = await this.mine(user)
    if (r.status !== 'DRAFT' && r.status !== 'REJECTED') {
      throw profileError('ERR_INVALID_STATE', "This application can't be submitted in its current state.", 409, { currentStatus: r.status })
    }
    const state = this.profile.readiness(r)
    if (!state.canSubmit) {
      // All three blockers together, so the client shows every applicable message.
      throw profileError('ERR_VALIDATION', 'Please complete your profile.', 422, {
        missingFields: state.missingFields,
        needsPayout: !state.payoutConfigured,
        needsCoverPhoto: !state.hasCoverPhoto,
      })
    }
    await this.review.submitted(r)
    return { success: true, data: { status: 'PENDING', message: 'Your application has been submitted and is under review.' } }
  }

  /** Where the "Add payout account" step sends the partner. */
  @Post('payments/onboarding-link')
  @HttpCode(200)
  async onboardingLink(@CurrentPartner() user: PartnerUser, @Req() req: Request) {
    const r = await this.mine(user)
    let origin = req.headers.origin
    if (!origin && req.headers.referer) origin = new URL(req.headers.referer).origin
    const back = trustedOrigin(origin) ? `?return=${encodeURIComponent(origin as string)}` : ''
    return {
      success: true,
      data: {
        url: `${config.publicUrl}/payouts/setup/${encodeURIComponent(r.id)}${back}`,
        mode: r.payoutAccountId ? 'UPDATE' : 'ONBOARDING',
      },
    }
  }

  // ── Contacts ──────────────────────────────────────────────────────────────

  @Get('contacts')
  async listContacts(@CurrentPartner() user: PartnerUser, @Query() q: Record<string, string>) {
    // A bad value is a 422 here, not a silent default.
    const bad = () => profileError('ERR_VALIDATION', 'Invalid sort or search parameter.', 422)
    if (q.sortBy && !SORTABLE.includes(q.sortBy)) throw bad()
    if (q.sortOrder && !['asc', 'desc'].includes(q.sortOrder)) throw bad()
    if (q.searchField && !SORTABLE.includes(q.searchField)) throw bad()

    let items = (await this.restaurants.contacts((await this.mine(user)).id)).map(contactShape)
    type Field = keyof (typeof items)[number]
    if (q.searchField && q.search?.trim()) {
      const needle = q.search.trim().toLowerCase()
      items = items.filter((c) => String(c[q.searchField as Field] ?? '').toLowerCase().includes(needle))
    }
    const sortBy = (q.sortBy || 'name') as Field
    items.sort((a, b) => String(a[sortBy] ?? '').localeCompare(String(b[sortBy] ?? '')))
    if (q.sortOrder === 'desc') items.reverse()
    return { success: true, data: { items } }
  }

  @Post('contacts')
  @HttpCode(201)
  async createContact(@CurrentPartner() user: PartnerUser, @Body() body: Record<string, unknown>) {
    const r = await this.mine(user)
    if (r.status === 'PENDING') throw readOnly()
    const name = String(body.name ?? '').trim()
    if (!name || name.length > 100) {
      throw profileError('ERR_VALIDATION', 'Contact name is required.', 422, { fields: { name: 'Contact name is required.' } })
    }
    const count = (await this.restaurants.contacts(r.id, true)).length
    const [created] = await this.db
      .insert(restaurantContacts)
      .values({
        restaurantId: r.id,
        id: `ct-${count + 1}`,
        name,
        title: (body.title as string) ?? null,
        email: (body.email as string) ?? null,
        phone: (body.phone as string) ?? null,
      })
      .returning()
    return { success: true, data: contactShape(created) }
  }

  @Patch('contacts/:contactId')
  async updateContact(@CurrentPartner() user: PartnerUser, @Param('contactId') id: string, @Body() body: Record<string, unknown>) {
    const r = await this.mine(user)
    if (r.status === 'PENDING') throw readOnly()
    const contact = (await this.restaurants.contacts(r.id)).find((c) => c.id === id)
    if (!contact) throw profileError('ERR_NOT_FOUND', 'Contact not found.', 404)
    const changes: Partial<Contact> = {}
    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) {
        throw profileError('ERR_VALIDATION', 'Please correct the highlighted fields.', 422, { fields: { name: 'Contact name is required.' } })
      }
      changes.name = name
    }
    if (body.title !== undefined) changes.title = body.title as string
    if (body.email !== undefined) changes.email = body.email as string
    if (body.phone !== undefined) changes.phone = body.phone as string
    const [updated] = Object.keys(changes).length
      ? await this.db
          .update(restaurantContacts)
          .set(changes)
          .where(and(eq(restaurantContacts.restaurantId, r.id), eq(restaurantContacts.id, id)))
          .returning()
      : [contact]
    return { success: true, data: contactShape(updated) }
  }

  @Delete('contacts/:contactId')
  async deleteContact(@CurrentPartner() user: PartnerUser, @Param('contactId') id: string) {
    const r = await this.mine(user)
    if (r.status === 'PENDING') throw readOnly()
    const live = await this.restaurants.contacts(r.id)
    if (!live.some((c) => c.id === id)) throw profileError('ERR_NOT_FOUND', 'Contact not found.', 404)
    if (live.length <= 1) throw profileError('ERR_LAST_CONTACT', 'At least one contact must remain.', 409, { remaining: 1 })
    // Soft delete: re-adding the same person later works.
    await this.db
      .update(restaurantContacts)
      .set({ deleted: true })
      .where(and(eq(restaurantContacts.restaurantId, r.id), eq(restaurantContacts.id, id)))
    return { success: true, data: { id, deleted: true } }
  }
}
