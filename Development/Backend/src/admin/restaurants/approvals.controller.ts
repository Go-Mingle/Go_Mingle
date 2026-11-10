import { Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common'
import { apiError, rawError } from '../../common/errors'
import { Body, jsonBody, num, Query, type Req as Request } from '../../common/http'
import { adminPath } from '../../shared/changelog/audit.interceptor'
import { ChangeLogService } from '../../shared/changelog/changelog.service'
import { displayPhone, type Restaurant } from '../../shared/restaurants/restaurants.service'
import { ReviewService } from '../../shared/restaurants/review.service'
import { AdminGuard, CurrentAdmin } from '../access/admin.guard'
import type { AdminSession } from '../access/admin-accounts.service'
import { AdminRestaurantsService } from './admin-restaurants.service'

const notFound = () => rawError(404, { success: false, error: { code: 'ERR_APPLICATION_NOT_FOUND', message: 'Not found' } })

/** PENDING / REJECTED while under review; APPROVED once the restaurant went live. */
const applicationStatus = (r: Restaurant) => (r.status === 'ACTIVE' ? 'APPROVED' : r.status)

function item(r: Restaurant) {
  return {
    id: r.id,
    name: r.name ?? '',
    cuisine: r.cuisine ?? '',
    ownerName: r.ownerName ?? '',
    ownerPhone: displayPhone(r.ownerPhone),
    ownerEmail: r.ownerEmail ?? '',
    city: r.city ?? '',
    submittedAt: r.submitted,
    ...(r.rejectedOn ? { rejectedAt: r.rejectedOn } : {}),
    ...(r.rejectionReason ? { latestReason: r.rejectionReason } : {}),
  }
}

/** The restaurant approval queue: /admin/api/v1/admin/approvals */
@Controller('admin/api/v1/admin/approvals')
@UseGuards(AdminGuard)
export class ApprovalsController {
  constructor(
    private readonly directory: AdminRestaurantsService,
    private readonly review: ReviewService,
    private readonly changeLog: ChangeLogService,
  ) {}

  @Get()
  async list(@Query() q: Record<string, string>) {
    const page = Math.max(1, num(q.page, 1))
    const pageSize = Math.max(1, num(q.pageSize, 25))
    const restaurant = (q.restaurant ?? '').trim().toLowerCase()
    const owner = (q.owner ?? '').trim().toLowerCase()

    let rows = await this.directory.all()
    if (q.status) {
      const want = q.status === 'rejected' ? 'REJECTED' : 'PENDING'
      rows = rows.filter((r) => applicationStatus(r) === want)
    }
    if (restaurant) rows = rows.filter((r) => (r.name ?? '').toLowerCase().includes(restaurant))
    if (owner) rows = rows.filter((r) => (r.ownerName ?? '').toLowerCase().includes(owner))

    const totalRecords = rows.length
    const start = (page - 1) * pageSize
    return {
      success: true,
      data: {
        items: rows.slice(start, start + pageSize).map(item),
        pagination: { page, pageSize, totalRecords, totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)) },
      },
    }
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const r = await this.directory.known(id)
    if (!r) throw notFound()
    return { success: true, data: { ...item(r), status: applicationStatus(r), rejectionHistory: [] } }
  }

  @Post(':id/approve')
  @HttpCode(200)
  async approve(@Param('id') id: string, @Body() body: { categoryId?: string }, @Req() req: Request, @CurrentAdmin() admin: AdminSession) {
    if (!body.categoryId) throw apiError(422, 'ERR_VALIDATION', 'Choose a category to approve.')
    const done = await this.review.approve(id, String(body.categoryId))
    if (!done) throw apiError(404, 'ERR_APPLICATION_NOT_FOUND', 'Application not found.')
    if ('error' in done) throw apiError(422, 'ERR_CATEGORY_NOT_FOUND', 'Choose an existing category.')
    const { name, ...data } = done
    await this.audit(req, admin, name)
    return { success: true, data }
  }

  @Post(':id/decline')
  @HttpCode(200)
  async decline(@Param('id') id: string, @Body() body: { reason?: unknown }, @Req() req: Request, @CurrentAdmin() admin: AdminSession) {
    const reason = String(body.reason ?? '').trim()
    if (!reason) throw apiError(422, 'ERR_VALIDATION', 'A reason is required to decline.')
    const done = await this.review.decline(id, reason)
    if (!done) throw apiError(404, 'ERR_APPLICATION_NOT_FOUND', 'Application not found.')
    const { name, ...data } = done
    await this.audit(req, admin, name)
    return { success: true, data }
  }

  /** The change log names the restaurant, not the application id. */
  private audit(req: Request, admin: AdminSession, name: string | null) {
    return this.changeLog.record({ method: req.method, path: adminPath(req), body: jsonBody(req), adminUser: admin, target: null, result: { name } })
  }
}
