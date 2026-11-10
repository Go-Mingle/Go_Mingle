import { Controller, Delete, Get, HttpCode, Inject, OnModuleInit, Param, Patch, Post, Res, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Response } from 'express'
import { asc, eq } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { interests } from '../../db/schema'
import { apiError } from '../../common/errors'
import { Body, Query } from '../../common/http'
import { stampId } from '../../common/ids'
import { AuditInterceptor } from '../../shared/changelog/audit.interceptor'
import { ChangeLogService } from '../../shared/changelog/changelog.service'
import { AdminGuard } from '../access/admin.guard'

type Row = typeof interests.$inferSelect

const shape = (i: Row) => ({ id: i.id, name: i.name, groupName: i.groupName, createdAt: i.createdAt, updatedAt: i.updatedAt })
const notFound = () => apiError(404, 'ERR_INTEREST_NOT_FOUND', 'Not found')
const nameInUse = (name: unknown) => apiError(409, 'ERR_INTEREST_NAME_IN_USE', 'Interest name already exists.', { name })

/** `pageSize` ∈ {25, 50, 100} (default 25) and `page` ≥ 1; anything else falls back. */
export function readPaging(q: Record<string, string>, sizes = [25, 50, 100], fallback = 25) {
  const size = Number.parseInt(q.pageSize ?? '', 10)
  const page = Number.parseInt(q.page ?? '', 10)
  return { page: Number.isFinite(page) && page >= 1 ? page : 1, pageSize: sizes.includes(size) ? size : fallback }
}

/** Interests: /admin/api/v1/interests */
@Controller('admin/api/v1/interests')
@UseGuards(AdminGuard)
@UseInterceptors(AuditInterceptor)
export class InterestsController implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly changeLog: ChangeLogService,
  ) {}

  onModuleInit() {
    this.changeLog.registerTarget('interests', async (id) => {
      const [i] = await this.db.select().from(interests).where(eq(interests.id, id))
      return i ? { record: shape(i) } : null
    })
  }

  private all() {
    return this.db.select().from(interests).orderBy(asc(interests.seq))
  }

  @Get()
  async list(@Query() q: Record<string, string>) {
    const { page, pageSize } = readPaging(q)
    const rows = await this.all()
    const totalRecords = rows.length
    return {
      success: true,
      data: {
        items: rows.slice((page - 1) * pageSize, page * pageSize).map(shape),
        pagination: { page, pageSize, totalRecords, totalPages: Math.ceil(totalRecords / pageSize) },
      },
    }
  }

  @Get('active')
  async active() {
    return { success: true, data: { items: (await this.all()).map((i) => ({ id: i.id, name: i.name, groupName: i.groupName })) } }
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const [i] = await this.db.select().from(interests).where(eq(interests.id, id))
    if (!i) throw notFound()
    return { success: true, data: shape(i) }
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: { name?: string; groupName?: string }) {
    const name = String(body.name ?? '')
    if ((await this.all()).some((i) => i.name.toLowerCase() === name.toLowerCase())) throw nameInUse(body.name)
    const [i] = await this.db
      .insert(interests)
      .values({ id: stampId('i'), name, groupName: body.groupName ?? null, createdAt: new Date().toISOString() })
      .returning()
    return { success: true, data: shape(i) }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { name?: string; groupName?: string }) {
    const rows = await this.all()
    if (!rows.some((i) => i.id === id)) throw notFound()
    if (body.name && rows.some((i) => i.id !== id && i.name.toLowerCase() === String(body.name).toLowerCase())) {
      throw nameInUse(body.name)
    }
    const changes: Partial<Row> = { updatedAt: new Date().toISOString() }
    if (body.name !== undefined) changes.name = body.name
    if (body.groupName !== undefined) changes.groupName = body.groupName
    const [i] = await this.db.update(interests).set(changes).where(eq(interests.id, id)).returning()
    return { success: true, data: shape(i) }
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Res() res: Response) {
    await this.db.delete(interests).where(eq(interests.id, id))
    res.status(204).end()
  }
}
