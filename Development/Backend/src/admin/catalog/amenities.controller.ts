import { Controller, Delete, Get, HttpCode, Inject, OnModuleInit, Param, Patch, Post, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request, Response } from 'express'
import { asc, eq, sql } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { amenities } from '../../db/schema'
import { apiError } from '../../common/errors'
import { Query } from '../../common/http'
import { formData, type UploadedFile } from '../../common/multipart'
import { AuditInterceptor } from '../../shared/changelog/audit.interceptor'
import { ChangeLogService } from '../../shared/changelog/changelog.service'
import { UsageService } from '../../shared/usage.service'
import { AdminGuard } from '../access/admin.guard'

type Row = typeof amenities.$inferSelect

const notFound = () => apiError(404, 'ERR_AMENITY_NOT_FOUND', 'Amenity not found.', {})
const nameInUse = (name: string) => apiError(409, 'ERR_AMENITY_NAME_IN_USE', 'Amenity name already exists.', { name })

/** The uploaded icon is kept as a data URL, so the image the admin chose is the one every screen shows. */
const iconDataUrl = (file: UploadedFile) => `data:${file.type || 'image/svg+xml'};base64,${file.bytes.toString('base64')}`

/** Amenities: /admin/api/v1/amenities */
@Controller('admin/api/v1/amenities')
@UseGuards(AdminGuard)
@UseInterceptors(AuditInterceptor)
export class AmenitiesController implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly usage: UsageService,
    private readonly changeLog: ChangeLogService,
  ) {}

  onModuleInit() {
    this.changeLog.registerTarget('amenities', async (id) => {
      const [a] = await this.db.select().from(amenities).where(eq(amenities.id, id))
      return a ? { record: await this.shape(a) } : null
    })
  }

  private async shape(a: Row) {
    return { id: a.id, name: a.name, iconUrl: a.iconUrl, ...(await this.usage.amenity(a.id)), createdAt: a.createdAt, updatedAt: a.updatedAt }
  }

  private all() {
    return this.db.select().from(amenities).orderBy(asc(amenities.seq))
  }

  /** Next id: a1, a2, … */
  private async nextId(): Promise<string> {
    const [row] = await this.db
      .select({ max: sql<number>`coalesce(max((substring(${amenities.id} from '^a(\\d+)$'))::int), 0)` })
      .from(amenities)
    return `a${Number(row?.max ?? 0) + 1}`
  }

  @Get()
  async list(@Query() q: Record<string, string>) {
    const page = Math.max(1, Number(q.page ?? '1'))
    const rawPageSize = Number(q.pageSize ?? '25')
    const pageSize = [25, 50, 100].includes(rawPageSize) ? rawPageSize : 25
    const sortBy = q.sortBy ?? 'name'
    const dir = (q.sortOrder ?? 'asc') === 'asc' ? 1 : -1
    const search = (q.q ?? '').toLowerCase()

    let items = await Promise.all((await this.all()).map((a) => this.shape(a)))
    if (search) items = items.filter((a) => a.name.toLowerCase().includes(search))
    items.sort((a, b) => (sortBy === 'count' ? (a.restaurantsCount - b.restaurantsCount) * dir : a.name.localeCompare(b.name) * dir))

    const totalRecords = items.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * pageSize
    return { success: true, data: { items: items.slice(start, start + pageSize), pagination: { page: safePage, pageSize, totalRecords, totalPages } } }
  }

  @Get('active')
  async active() {
    return { success: true, data: { items: (await this.all()).map(({ id, name, iconUrl }) => ({ id, name, iconUrl })) } }
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const [a] = await this.db.select().from(amenities).where(eq(amenities.id, id))
    if (!a) throw notFound()
    return { success: true, data: await this.shape(a) }
  }

  @Post()
  @HttpCode(201)
  async create(@Req() req: Request) {
    const fd = await formData(req)
    const name = fd.text('name')?.trim() ?? ''
    if (!name) throw apiError(400, 'ERR_VALIDATION', 'Name is required.', {})
    if ((await this.all()).some((a) => a.name.toLowerCase() === name.toLowerCase())) throw nameInUse(name)
    const icon = await fd.file('icon')
    const now = new Date().toISOString()
    const [a] = await this.db
      .insert(amenities)
      .values({ id: await this.nextId(), name, iconUrl: icon ? iconDataUrl(icon) : null, createdAt: now, updatedAt: now })
      .returning()
    return { success: true, data: await this.shape(a) }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Req() req: Request) {
    const fd = await formData(req)
    const name = fd.text('name')?.trim() ?? ''
    const rows = await this.all()
    if (!rows.some((a) => a.id === id)) throw notFound()
    if (name && rows.some((a) => a.id !== id && a.name.toLowerCase() === name.toLowerCase())) throw nameInUse(name)

    const changes: Partial<Row> = { updatedAt: new Date().toISOString() }
    if (name) changes.name = name
    // The portal sends either a replacement file or a reset flag, never both.
    const icon = await fd.file('icon')
    if (icon) changes.iconUrl = iconDataUrl(icon)
    else if (fd.text('resetIcon') === 'true') changes.iconUrl = null
    const [a] = await this.db.update(amenities).set(changes).where(eq(amenities.id, id)).returning()
    return { success: true, data: await this.shape(a) }
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Res() res: Response) {
    const [a] = await this.db.delete(amenities).where(eq(amenities.id, id)).returning()
    if (!a) throw notFound()
    res.status(204).end()
  }
}
