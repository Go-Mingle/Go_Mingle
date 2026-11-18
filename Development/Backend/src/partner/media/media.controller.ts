import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, UseGuards } from '@nestjs/common'
import { Body, Query } from '../../common/http'
import { coverPhotoUrl, profilePhotoUrl, RestaurantsService, type Restaurant } from '../../shared/restaurants/restaurants.service'
import { CurrentPartner, PartnerGuard } from '../access/partner.guard'
import type { PartnerUser } from '../access/partner-accounts.service'
import { profileError, readOnly } from '../profile/profile.service'
import { LIMITS, MediaService, type PhotoRole } from './media.service'
import type { Crop } from '../../db/schema'

const SORT_FIELDS = ['name', 'type', 'size']

/** A crop is four fractions of the photo, inside it and not empty. Anything else is refused. */
function readCrop(value: unknown): Crop {
  const bad = () => profileError('ERR_VALIDATION', 'Choose the part of the photo to keep.', 422)
  if (!value || typeof value !== 'object') throw bad()
  const c = value as Record<string, unknown>
  const keys = ['x', 'y', 'width', 'height'] as const
  if (Object.keys(c).some((k) => !(keys as readonly string[]).includes(k))) throw bad()
  if (!keys.every((k) => typeof c[k] === 'number' && Number.isFinite(c[k]))) throw bad()
  const { x, y, width, height } = c as unknown as Crop
  const EPS = 0.001
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 + EPS || y + height > 1 + EPS) throw bad()
  const round = (n: number) => Math.round(n * 1e6) / 1e6
  return { x: round(x), y: round(y), width: round(width), height: round(height) }
}
const SORT_ORDERS = ['asc', 'desc']
type Json = Record<string, unknown>

/** Documents, photos and videos: /partner/api/v1/partner/restaurant/{documents,media,photos,videos} */
@Controller('partner/api/v1/partner/restaurant')
@UseGuards(PartnerGuard)
export class MediaController {
  constructor(
    private readonly restaurants: RestaurantsService,
    private readonly media: MediaService,
  ) {}

  private mine(user: PartnerUser): Promise<Restaurant> {
    return this.restaurants.ensure(user.restaurantId)
  }

  private async editable(user: PartnerUser): Promise<Restaurant> {
    const r = await this.mine(user)
    if (r.status === 'PENDING') throw readOnly()
    return r
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  @Post('documents/upload-url')
  @HttpCode(200)
  async documentUploadUrl(@CurrentPartner() user: PartnerUser, @Body() body: Json) {
    return { success: true, data: await this.media.uploadTarget(await this.mine(user), 'document', body) }
  }

  @Get('documents/:mediaId/download-url')
  async documentDownloadUrl(@CurrentPartner() user: PartnerUser, @Param('mediaId') mediaId: string) {
    const r = await this.mine(user)
    if (!(await this.media.find(r.id, mediaId, 'document'))) throw profileError('ERR_NOT_FOUND', 'Document not found.', 404)
    // Short-lived by design: re-requested on every click, never cached.
    return { success: true, data: { downloadUrl: this.media.downloadUrl(r.id, mediaId), expiresInSeconds: 300 } }
  }

  @Get('documents')
  async documents(@CurrentPartner() user: PartnerUser, @Query() q: Record<string, string>) {
    // A bad param is a 422, never a silent fallback.
    if ((q.sortBy && !SORT_FIELDS.includes(q.sortBy)) || (q.sortOrder && !SORT_ORDERS.includes(q.sortOrder))) {
      throw profileError('ERR_VALIDATION', 'Invalid sort or search parameter.', 422)
    }
    let items = (await this.media.list((await this.mine(user)).id, 'document')).map((d) => this.media.document(d))
    // Name only: Type and Size are sortable but not searchable.
    const search = q.search?.trim().toLowerCase()
    if (search) items = items.filter((item) => item.name.toLowerCase().includes(search))
    const field = (q.sortBy || 'name') as 'name' | 'type' | 'size'
    const descending = q.sortOrder === 'desc'
    items.sort((a, b) => {
      const compared = field === 'size' ? (a.size ?? 0) - (b.size ?? 0) : String(a[field]).localeCompare(String(b[field]))
      return descending ? -compared : compared
    })
    return { success: true, data: { items } }
  }

  @Post('documents')
  @HttpCode(201)
  async commitDocument(@CurrentPartner() user: PartnerUser, @Body() body: Json) {
    const r = await this.mine(user)
    const entry = await this.media.takeMedia(r, 'document', body)
    return { success: true, data: this.media.document(await this.media.add(r, 'document', entry, 'doc')) }
  }

  @Delete('documents/:mediaId')
  async deleteDocument(@CurrentPartner() user: PartnerUser, @Param('mediaId') mediaId: string) {
    const r = await this.editable(user)
    if (!(await this.media.find(r.id, mediaId, 'document'))) throw profileError('ERR_NOT_FOUND', 'Document not found.', 404)
    await this.media.remove(r.id, mediaId)
    return { success: true, data: { mediaId, removed: true } }
  }

  // ── Gallery ───────────────────────────────────────────────────────────────

  @Get('media')
  async gallery(@CurrentPartner() user: PartnerUser) {
    const { photos, videos } = await this.media.gallery((await this.mine(user)).id)
    return {
      success: true,
      data: {
        photos: { count: photos.length, max: LIMITS.photo.maxCount, items: photos },
        videos: { count: videos.length, max: LIMITS.video.maxCount, items: videos },
      },
    }
  }

  // ── Photos ────────────────────────────────────────────────────────────────

  @Post('photos/upload-url')
  @HttpCode(200)
  async photoUploadUrl(@CurrentPartner() user: PartnerUser, @Body() body: Json) {
    return { success: true, data: await this.media.uploadTarget(await this.mine(user), 'photo', body) }
  }

  /** The whole photo as the cover, no crop. Kept for older clients; the portal uses PUT with a crop. */
  @Patch('photos/:mediaId/cover')
  async setCover(@CurrentPartner() user: PartnerUser, @Param('mediaId') mediaId: string) {
    const r = await this.editable(user)
    const source = await this.media.find(r.id, mediaId, 'photo')
    if (!source) throw profileError('ERR_NOT_FOUND', 'Photo not found.', 404)
    await this.media.assignRole(r, 'cover', source, null, null)
    return { success: true, data: { mediaId, isCover: true } }
  }

  /** Where the cover and the profile picture come from, and their crops. */
  @Get('photo-roles')
  async photoRoles(@CurrentPartner() user: PartnerUser) {
    return { success: true, data: this.media.roles(await this.mine(user)) }
  }

  /** An upload target for a cropped cover or profile picture. Not a gallery photo, so the gallery's limit does not apply. */
  @Post('photos/crop-upload-url')
  @HttpCode(200)
  async cropUploadUrl(@CurrentPartner() user: PartnerUser, @Body() body: Json) {
    return { success: true, data: await this.media.uploadTarget(await this.mine(user), 'photo', body, { crop: true }) }
  }

  /**
   * Sets a gallery photo as the cover (8:3) or the profile picture (square,
   * shown as a circle), with the part to keep. Body: `{ crop: { x, y, width,
   * height } }` as fractions of the photo, and `uploadRef`: the cropped image,
   * uploaded through `photos/crop-upload-url`.
   */
  @Put('photos/:mediaId/:role')
  async setRole(@CurrentPartner() user: PartnerUser, @Param('mediaId') mediaId: string, @Param('role') role: string, @Body() body: Json) {
    if (role !== 'cover' && role !== 'profile') throw profileError('ERR_NOT_FOUND', 'Not found.', 404)
    const r = await this.editable(user)
    const extra = Object.keys(body).filter((k) => k !== 'crop' && k !== 'uploadRef')
    if (extra.length) throw profileError('ERR_VALIDATION', `Property ${extra.join(', ')} is not allowed on this request.`, 422)
    const source = await this.media.find(r.id, mediaId, 'photo')
    if (!source) throw profileError('ERR_NOT_FOUND', 'Photo not found.', 404)
    const crop = readCrop(body.crop)
    const cropped = await this.media.takeMedia(r, 'photo', { uploadRef: body.uploadRef })
    const updated = await this.media.assignRole(r, role as PhotoRole, source, crop, cropped)
    return {
      success: true,
      data: { mediaId, role, crop, ...this.media.roles(updated), coverPhotoUrl: coverPhotoUrl(updated), profilePhotoUrl: profilePhotoUrl(updated) },
    }
  }

  /** No profile picture: the restaurant shows its initials. The photo stays in the gallery. */
  @Delete('profile-photo')
  async clearProfile(@CurrentPartner() user: PartnerUser) {
    const r = await this.editable(user)
    await this.media.dropProfile(r.id)
    return { success: true, data: { profilePhotoUrl: null } }
  }

  @Post('photos')
  @HttpCode(201)
  async commitPhoto(@CurrentPartner() user: PartnerUser, @Body() body: Json) {
    const r = await this.mine(user)
    const entry = await this.media.takeMedia(r, 'photo', body)
    // The first photo silently becomes the cover, which is what unblocks submission.
    const becameCover = r.mainPhotoKey === null
    const count = (await this.media.list(r.id, 'photo')).length
    const row = await this.media.add(r, 'photo', entry, 'photo', { sortOrder: count + 1 })
    const updated = becameCover ? await this.restaurants.update(r.id, { mainPhotoKey: `photos/${row.mediaId}.jpg`, coverCrop: null, coverImageId: null }) : r
    const photo = this.media.photo(row, updated)
    return {
      success: true,
      data: { mediaId: photo.mediaId, url: photo.url, isCover: becameCover, name: photo.name, size: photo.size, uploadedAt: photo.uploadedAt, becameCover },
    }
  }

  @Delete('photos/:mediaId')
  async deletePhoto(@CurrentPartner() user: PartnerUser, @Param('mediaId') mediaId: string) {
    const r = await this.editable(user)
    const photo = await this.media.find(r.id, mediaId, 'photo')
    if (!photo) throw profileError('ERR_NOT_FOUND', 'Photo not found.', 404)
    const isCover = r.mainPhotoKey === `photos/${mediaId}.jpg`
    // Removing the cover while others remain would leave no cover: a new one must be designated first.
    if (isCover && (await this.media.list(r.id, 'photo')).length > 1) {
      throw profileError('ERR_COVER_PHOTO_REASSIGN', 'Please set a new cover photo before deleting this one.', 409)
    }
    await this.media.remove(r.id, mediaId)
    if (isCover) await this.media.dropCover(r.id)
    // The profile picture is optional: removing its photo just clears it.
    const wasProfile = r.profilePhotoKey === `photos/${mediaId}.jpg`
    if (wasProfile) await this.media.dropProfile(r.id)
    return { success: true, data: { mediaId, removed: true, ...(wasProfile ? { profileCleared: true } : {}) } }
  }

  // ── Videos ────────────────────────────────────────────────────────────────

  @Post('videos/upload-url')
  @HttpCode(200)
  async videoUploadUrl(@CurrentPartner() user: PartnerUser, @Body() body: Json) {
    return { success: true, data: await this.media.uploadTarget(await this.mine(user), 'video', body) }
  }

  @Post('videos')
  @HttpCode(201)
  async commitVideo(@CurrentPartner() user: PartnerUser, @Body() body: Json) {
    const r = await this.mine(user)
    const entry = await this.media.takeMedia(r, 'video', body)
    const count = (await this.media.list(r.id, 'video')).length
    // Ready on the next gallery read, so one poll observes the transition.
    const row = await this.media.add(r, 'video', entry, 'video', { sortOrder: count + 1, readyAfterReads: (await this.media.galleryReads(r.id)) + 1 })
    return { success: true, data: { mediaId: row.mediaId, name: row.name, status: 'processing', size: row.size, uploadedAt: row.uploadedAt } }
  }

  @Delete('videos/:mediaId')
  async deleteVideo(@CurrentPartner() user: PartnerUser, @Param('mediaId') mediaId: string) {
    const r = await this.editable(user)
    if (!(await this.media.find(r.id, mediaId, 'video'))) throw profileError('ERR_NOT_FOUND', 'Video not found.', 404)
    await this.media.remove(r.id, mediaId)
    return { success: true, data: { mediaId, removed: true } }
  }
}
