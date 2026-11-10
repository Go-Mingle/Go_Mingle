import { Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'
import { and, asc, eq } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { mediaUploads, menuOptions, menuPdfs, type ComboCourse } from '../../db/schema'
import { Body } from '../../common/http'
import { CountersService } from '../../shared/counters.service'
import { cdnUrl, RestaurantsService, type Restaurant } from '../../shared/restaurants/restaurants.service'
import { UsageService } from '../../shared/usage.service'
import { CurrentPartner, PartnerGuard } from '../access/partner.guard'
import type { PartnerUser } from '../access/partner-accounts.service'
import { bucketQualifiedKey, bytesMatchContentType, uploadUrl } from '../media/media.service'
import { profileError, readOnly } from '../profile/profile.service'

type Json = Record<string, unknown>
type Option = typeof menuOptions.$inferSelect

const MENU_PDF_MAX_BYTES = 10 * 1024 * 1024
const optionNotFound = () => profileError('ERR_NOT_FOUND', 'Menu option not found.', 404)

/** The public URL of a restaurant's current menu PDF. */
export function menuPdfUrl(r: Pick<Restaurant, 'id' | 'menuPdfFile'>): string | null {
  return r.menuPdfFile ? cdnUrl(r.id, `menu/${r.menuPdfFile}`) : null
}

/** `Autumn Menu 2026.PDF` → `autumn-menu-2026.pdf`: the stored name, shown as is. */
function slugify(name: string): string {
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const slug = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'menu'}.pdf`
}

function optionErrors(body: Json): Record<string, string> {
  const fields: Record<string, string> = {}
  if (typeof body.name !== 'string' || !body.name.trim()) fields.name = 'Name is required.'
  else if (body.name.length > 255) fields.name = 'Name must be 255 characters or fewer.'

  if (typeof body.pricePkr !== 'number' || !Number.isFinite(body.pricePkr)) fields.pricePkr = 'Price is required.'
  else if (body.pricePkr < 0) fields.pricePkr = 'Price cannot be negative.'

  const courses = body.courses
  if (!Array.isArray(courses) || courses.length < 1) fields.courses = 'Add at least one section.'
  else if (courses.length > 20) fields.courses = 'A menu option can have at most 20 sections.'
  else {
    courses.forEach((raw, index) => {
      const course = (raw ?? {}) as Partial<ComboCourse>
      const items = Array.isArray(course.options) ? course.options : []
      if (typeof course.course !== 'string' || !course.course.trim()) fields[`courses.${index}.course`] = 'Section name is required.'
      if (items.length < 1) fields[`courses.${index}.options`] = 'Add at least one item.'
      if (typeof course.choose !== 'number' || !Number.isInteger(course.choose) || course.choose < 1) {
        fields[`courses.${index}.choose`] = 'Choice of must be at least 1.'
      } else if (items.length > 0 && course.choose > items.length) {
        fields[`courses.${index}.choose`] = "You can't ask diners to choose more items than the section offers."
      }
    })
  }
  return fields
}

const draft = (body: Json) => ({
  name: body.name as string,
  pricePkr: body.pricePkr as number,
  courses: (body.courses as ComboCourse[]).map((c) => ({ course: c.course, choose: c.choose, options: [...c.options] })),
})

const shape = (o: Option) => ({ comboId: o.comboId, isHidden: o.isHidden, name: o.name, pricePkr: o.pricePkr, courses: o.courses })

/**
 * The Menu tab: one optional menu PDF and the prix-fixe menu options.
 * /partner/api/v1/partner/restaurant/{menu-pdf,menu-options}
 */
@Controller('partner/api/v1/partner/restaurant')
@UseGuards(PartnerGuard)
export class MenuController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly restaurants: RestaurantsService,
    private readonly counters: CountersService,
    private readonly usage: UsageService,
  ) {}

  private async editable(user: PartnerUser): Promise<Restaurant> {
    const r = await this.restaurants.ensure(user.restaurantId)
    if (r.status === 'PENDING') throw readOnly()
    return r
  }

  private options(restaurantId: string): Promise<Option[]> {
    return this.db.select().from(menuOptions).where(eq(menuOptions.restaurantId, restaurantId)).orderBy(asc(menuOptions.seq))
  }

  // ── Menu PDF ──────────────────────────────────────────────────────────────

  @Get('menu-pdf')
  async pdf(@CurrentPartner() user: PartnerUser) {
    const r = await this.restaurants.ensure(user.restaurantId)
    return { success: true, data: { menuUrl: menuPdfUrl(r), name: r.menuPdfName } }
  }

  /** Step 1: PDF only, refused before any upload target exists. */
  @Post('menu-pdf/upload-url')
  @HttpCode(200)
  async pdfUploadUrl(@CurrentPartner() user: PartnerUser, @Body() body: Json) {
    const r = await this.editable(user)
    if (body.contentType !== 'application/pdf' || typeof body.name !== 'string' || !body.name) {
      throw profileError('ERR_VALIDATION', 'Only a PDF menu is allowed.', 422)
    }
    const uploadRef = `mu-${await this.counters.next(r.id, 'menu')}`
    await this.db.insert(mediaUploads).values({ restaurantId: r.id, uploadRef, kind: 'menu', name: body.name, contentType: 'application/pdf' })
    return {
      success: true,
      data: {
        uploadUrl: uploadUrl(r.id, uploadRef, 'mock-menu-upload'),
        // Always `.pdf`: the object is named from the content type, not the picked file.
        key: bucketQualifiedKey('menu', r.id, uploadRef, 'menu.pdf'),
        uploadRef,
        maxBytes: MENU_PDF_MAX_BYTES,
        expiresInSeconds: 900,
      },
    }
  }

  /** Step 3: the uploaded file becomes the menu, replacing any earlier one. */
  @Put('menu-pdf')
  async commitPdf(@CurrentPartner() user: PartnerUser, @Body() body: Json) {
    const r = await this.editable(user)
    const where = and(eq(mediaUploads.restaurantId, r.id), eq(mediaUploads.uploadRef, String(body.uploadRef)), eq(mediaUploads.kind, 'menu'))
    const [entry] = await this.db.select().from(mediaUploads).where(where)
    // A used or unknown reference: what a retried commit sees.
    if (!entry) throw profileError('ERR_NOT_FOUND', 'No upload was found for that reference.', 404)
    if (!entry.received) throw profileError('ERR_VALIDATION', 'No uploaded file was found for this reference.', 422)
    // Consumed before verification: a failed commit restarts the upload.
    await this.db.delete(mediaUploads).where(where)

    if (entry.size > MENU_PDF_MAX_BYTES) throw profileError('ERR_MEDIA_TOO_LARGE', 'This file is larger than the 10 MB limit.', 413)
    if (!bytesMatchContentType(entry.bytes, entry.contentType)) {
      throw profileError('ERR_MEDIA_TYPE', "This file type isn't supported for this section.", 422, {
        contentType: entry.contentType,
        message: 'Only a PDF menu is allowed.',
      })
    }

    const name = slugify(entry.name)
    const file = `${entry.uploadRef}-${name}`
    await this.db.insert(menuPdfs).values({ restaurantId: r.id, file, bytes: entry.bytes as Buffer })
    const updated = await this.restaurants.update(r.id, { menuPdfFile: file, menuPdfName: name })
    return { success: true, data: { menuUrl: menuPdfUrl(updated), name } }
  }

  @Delete('menu-pdf')
  async removePdf(@CurrentPartner() user: PartnerUser) {
    const r = await this.editable(user)
    if (!r.menuPdfFile) throw profileError('ERR_NOT_FOUND', 'No menu PDF to remove.', 404)
    await this.restaurants.update(r.id, { menuPdfFile: null, menuPdfName: null })
    return { success: true, data: { menuUrl: null } }
  }

  // ── Menu options ──────────────────────────────────────────────────────────

  /** Hidden options included; the tab badges them. */
  @Get('menu-options')
  async list(@CurrentPartner() user: PartnerUser) {
    const r = await this.restaurants.ensure(user.restaurantId)
    return { success: true, data: { items: (await this.options(r.id)).map(shape) } }
  }

  @Post('menu-options')
  @HttpCode(201)
  async create(@CurrentPartner() user: PartnerUser, @Body() body: Json) {
    const r = await this.editable(user)
    const fields = optionErrors(body)
    if (Object.keys(fields).length) throw profileError('ERR_VALIDATION', 'Please correct the highlighted fields.', 422, { fields })
    const [row] = await this.db
      .insert(menuOptions)
      .values({ restaurantId: r.id, comboId: `c-${await this.counters.next(r.id, 'menu')}`, ...draft(body) })
      .returning()
    return { success: true, data: shape(row) }
  }

  @Patch('menu-options/:comboId/visibility')
  async visibility(@CurrentPartner() user: PartnerUser, @Param('comboId') comboId: string, @Body() body: Json) {
    const r = await this.editable(user)
    const where = and(eq(menuOptions.restaurantId, r.id), eq(menuOptions.comboId, comboId))
    if (!(await this.db.select().from(menuOptions).where(where)).length) throw optionNotFound()
    if (typeof body.hidden !== 'boolean') throw profileError('ERR_VALIDATION', 'Invalid request.', 422)
    await this.db.update(menuOptions).set({ isHidden: body.hidden }).where(where)
    return { success: true, data: { comboId, isHidden: body.hidden } }
  }

  /** Replaces name, price and every section. */
  @Patch('menu-options/:comboId')
  async update(@CurrentPartner() user: PartnerUser, @Param('comboId') comboId: string, @Body() body: Json) {
    const r = await this.editable(user)
    const where = and(eq(menuOptions.restaurantId, r.id), eq(menuOptions.comboId, comboId))
    if (!(await this.db.select().from(menuOptions).where(where)).length) throw optionNotFound()
    const fields = optionErrors(body)
    if (Object.keys(fields).length) throw profileError('ERR_VALIDATION', 'Please correct the highlighted fields.', 422, { fields })
    const [row] = await this.db.update(menuOptions).set(draft(body)).where(where).returning()
    return { success: true, data: shape(row) }
  }

  @Delete('menu-options/:comboId')
  async remove(@CurrentPartner() user: PartnerUser, @Param('comboId') comboId: string) {
    const r = await this.editable(user)
    const where = and(eq(menuOptions.restaurantId, r.id), eq(menuOptions.comboId, comboId))
    if (!(await this.db.select().from(menuOptions).where(where)).length) throw optionNotFound()
    const upcomingTables = await this.usage.upcomingTablesUsingCombo(r.id, comboId)
    if (upcomingTables) {
      throw profileError(
        'ERR_MENU_OPTION_IN_USE',
        "This menu option is used by an upcoming interest table and can't be deleted. You can hide it instead.",
        409,
        { upcomingTables },
      )
    }
    await this.db.delete(menuOptions).where(where)
    return { success: true, data: { comboId, deleted: true } }
  }
}

/** Step 2 of the menu upload: /t/<restaurant>/mock-menu-upload/<uploadRef> (stands in for the presigned S3 PUT). */
@Controller('t/:restaurantId/mock-menu-upload')
export class MenuUploadController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Put(':uploadRef')
  async put(@Param('restaurantId') restaurantId: string, @Param('uploadRef') uploadRef: string, @Req() req: Request, @Res() res: Response) {
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    const rows = await this.db
      .update(mediaUploads)
      .set({ received: true, size: bytes.length, bytes })
      .where(and(eq(mediaUploads.restaurantId, restaurantId), eq(mediaUploads.uploadRef, uploadRef), eq(mediaUploads.kind, 'menu')))
      .returning({ ref: mediaUploads.uploadRef })
    return res.status(rows.length > 0 ? 200 : 403).end()
  }
}
