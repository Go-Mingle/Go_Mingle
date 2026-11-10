import { Controller, Get, HttpCode, Inject, Param, Patch, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { categories } from '../../db/schema'
import { rawError } from '../../common/errors'
import { Body, Query, type Req as Request } from '../../common/http'
import { MediaService } from '../../partner/media/media.service'
import { AuditInterceptor } from '../../shared/changelog/audit.interceptor'
import { adminStatus, displayPhone, RestaurantsService, type Restaurant } from '../../shared/restaurants/restaurants.service'
import { ReviewService } from '../../shared/restaurants/review.service'
import { AdminGuard } from '../access/admin.guard'
import { AdminRestaurantsService } from './admin-restaurants.service'

const DIRECTORY_STATUSES = ['ACTIVE', 'SUSPENDED']
const MEDIA_KINDS = ['DOCUMENT', 'PHOTO', 'VIDEO']

const fail = (status: number, code: string, message?: string) =>
  rawError(status, { success: false, error: message ? { code, message } : { code } })
const notFound = () => fail(404, 'ERR_RESTAURANT_NOT_FOUND', 'Restaurant not found.')
/** Some routes answer a missing restaurant with the code only. */
const notFoundBare = () => fail(404, 'ERR_RESTAURANT_NOT_FOUND')

/** Repeated query values (`?statuses=A&statuses=B`) as a list. */
function all(req: Request, key: string): string[] {
  const v = req.query[key]
  return v === undefined ? [] : (Array.isArray(v) ? v : [v]).map(String)
}

/** The restaurant directory: /admin/api/v1/restaurants */
@Controller('admin/api/v1/restaurants')
@UseGuards(AdminGuard)
@UseInterceptors(AuditInterceptor)
export class RestaurantsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly directory: AdminRestaurantsService,
    private readonly restaurants: RestaurantsService,
    private readonly review: ReviewService,
    private readonly media: MediaService,
  ) {}

  /** Live and suspended restaurants. Applications under review belong to the approval queue. */
  @Get()
  async list(@Req() req: Request, @Query() q: Record<string, string>) {
    const page = Math.max(1, parseInt(q.page ?? '1', 10))
    const rawSize = parseInt(q.pageSize ?? '10', 10)
    const pageSize = [10, 25, 50].includes(rawSize) ? rawSize : 10
    const search = (q.q ?? '').toLowerCase()
    const descending = q.sortOrder === 'desc'
    const categoryIds = all(req, 'categoryIds')
    const statuses = all(req, 'statuses')
    if (statuses.some((s) => !DIRECTORY_STATUSES.includes(s))) {
      throw fail(422, 'ERR_VALIDATION', `Each status must be one of: ${DIRECTORY_STATUSES.join(', ')}.`)
    }

    const cats = await this.directory.categoriesById()
    let rows = (await this.directory.all()).filter((r) => DIRECTORY_STATUSES.includes(adminStatus(r)))
    if (categoryIds.length) rows = rows.filter((r) => categoryIds.includes(r.categoryId ?? ''))
    if (q.cities) rows = rows.filter((r) => (r.city ?? '').toLowerCase().includes(q.cities.toLowerCase()))
    if (statuses.length) rows = rows.filter((r) => statuses.includes(adminStatus(r)))
    if (search) rows = rows.filter((r) => (r.name ?? '').toLowerCase().includes(search))

    const key = (r: Restaurant): string | number => {
      switch (q.sortBy) {
        case 'cuisine':
          return r.cuisine ?? ''
        case 'city':
          return r.city ?? ''
        case 'category':
          return cats.get(r.categoryId ?? '')?.name ?? ''
        case 'joinedAt':
          return r.joined ?? ''
        case 'status':
          return adminStatus(r)
        case 'bookings':
          return 0
        default:
          return r.name ?? ''
      }
    }
    rows.sort((a, b) => {
      const x = key(a)
      const y = key(b)
      const cmp = typeof x === 'number' ? x - (y as number) : x.localeCompare(y as string)
      return descending ? -cmp : cmp
    })

    const totalRecords = rows.length
    return {
      success: true,
      data: {
        items: rows.slice((page - 1) * pageSize, page * pageSize).map((r) => this.directory.listItem(r, cats.get(r.categoryId ?? ''))),
        pagination: { page, pageSize, totalRecords, totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)) },
      },
    }
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const r = await this.directory.known(id)
    if (!r) throw notFoundBare()
    return { success: true, data: this.directory.detail(r, await this.restaurants.category(r)) }
  }

  /** Read-only here: contacts are managed by the partner. */
  @Get(':id/contacts')
  async contacts(@Param('id') id: string) {
    const r = await this.directory.known(id)
    if (!r) throw notFound()
    const items = (await this.restaurants.contacts(r.id))
      .map((c) => ({ id: c.id, name: c.name, title: c.title ?? '', email: c.email ?? '', phone: c.phone ? displayPhone(c.phone) : '' }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return { success: true, data: { items } }
  }

  @Get(':id/tables')
  async tables(@Param('id') id: string) {
    const r = await this.directory.known(id)
    if (!r) throw notFoundBare()
    return { success: true, data: { items: await this.directory.tablesOf(r) } }
  }

  @Get(':id/menu-options')
  async menuOptions(@Param('id') id: string) {
    const r = await this.directory.known(id)
    if (!r) throw notFoundBare()
    return { success: true, data: { items: await this.directory.menuOptionsOf(r) } }
  }

  @Get(':id/amenities')
  async amenities(@Param('id') id: string) {
    const r = await this.directory.known(id)
    if (!r) throw notFoundBare()
    return { success: true, data: { items: await this.directory.amenitiesOf(r) } }
  }

  /** What the partner uploaded: documents for the review, photos and videos for the listing. */
  @Get(':id/media')
  async mediaOf(@Param('id') id: string, @Query() q: Record<string, string>) {
    const r = await this.restaurants.find(id)
    if (!r) throw notFound()
    const kind = q.kind ?? 'PHOTO'
    if (!MEDIA_KINDS.includes(kind)) throw fail(400, 'ERR_VALIDATION', 'Invalid media kind.')
    if (kind === 'DOCUMENT') {
      const docs = (await this.media.list(r.id, 'document')).map((d) => this.media.document(d)).sort((a, b) => a.name.localeCompare(b.name))
      const items = docs.map((d, i) => ({
        kind,
        name: d.name,
        contentType: d.type === 'PDF' ? 'application/pdf' : `image/${(d.type || 'jpeg').toLowerCase()}`,
        sortOrder: i,
        url: this.media.downloadUrl(r.id, d.mediaId),
      }))
      return { success: true, data: { items } }
    }
    const gallery = await this.media.gallery(r.id)
    const list: { name: string; mediaId: string; sortOrder: number | null; url: string | null; thumbnailUrl?: string | null }[] =
      kind === 'VIDEO' ? gallery.videos : gallery.photos
    const items = list.map((m, i) => ({
      kind,
      name: m.name ?? m.mediaId,
      contentType: kind === 'VIDEO' ? 'video/mp4' : 'image/jpeg',
      sortOrder: m.sortOrder ?? i,
      url: m.url ?? '',
      ...(m.thumbnailUrl ? { thumbnailUrl: m.thumbnailUrl } : {}),
    }))
    return { success: true, data: { items } }
  }

  @Get(':id/bookings/count-active')
  async activeBookings(@Param('id') id: string) {
    if (!(await this.directory.known(id))) throw notFound()
    return { success: true, data: { count: 0 } }
  }

  @Patch(':id/category')
  async changeCategory(@Param('id') id: string, @Body() body: { categoryId?: string }) {
    const r = await this.directory.known(id)
    if (!r) throw notFoundBare()
    const [category] = await this.db.select().from(categories).where(eq(categories.id, String(body.categoryId ?? '')))
    if (!category) throw fail(404, 'ERR_CATEGORY_NOT_FOUND')
    await this.review.changeCategory(r.id, category)
    return { success: true, data: { id: r.id, category: { id: category.id, name: category.name } } }
  }

  @Post(':id/suspend')
  @HttpCode(200)
  async suspend(@Param('id') id: string, @Body() body: { reason?: string }) {
    const r = await this.directory.known(id)
    if (!r) throw notFound()
    if (!body.reason || body.reason.length < 10) throw fail(400, 'ERR_VALIDATION', 'A reason of at least 10 characters is required.')
    if (adminStatus(r) !== 'ACTIVE') throw fail(409, 'ERR_RESTAURANT_ALREADY_ACTIONED', 'Restaurant is not active.')
    await this.review.suspend(r.id, body.reason)
    return { success: true, data: { id: r.id, status: 'SUSPENDED', bookingsCancelled: 0 } }
  }

  @Post(':id/unsuspend')
  @HttpCode(200)
  async unsuspend(@Param('id') id: string) {
    const r = await this.directory.known(id)
    if (!r) throw notFound()
    if (adminStatus(r) !== 'SUSPENDED') throw fail(409, 'ERR_RESTAURANT_ALREADY_ACTIONED', 'Restaurant is not suspended.')
    await this.review.unsuspend(r.id)
    return { success: true, data: { id: r.id, status: 'ACTIVE' } }
  }
}
