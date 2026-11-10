import { Controller, Delete, Get, HttpCode, Inject, OnModuleInit, Param, Patch, Post, Res, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Response } from 'express'
import { asc, eq } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { categories } from '../../db/schema'
import { apiError, rawError } from '../../common/errors'
import { Body } from '../../common/http'
import { stampId } from '../../common/ids'
import { AuditInterceptor } from '../../shared/changelog/audit.interceptor'
import { ChangeLogService } from '../../shared/changelog/changelog.service'
import { UsageService } from '../../shared/usage.service'
import { AdminGuard } from '../access/admin.guard'

type Row = typeof categories.$inferSelect
type CategoryBody = { name?: string; commissionRate?: number; interestTablesPerMonth?: number }

const notFound = () => rawError(404, { message: 'Not found' })
const nameInUse = (name: unknown) => apiError(409, 'ERR_CATEGORY_NAME_IN_USE', 'Category name already exists.', { name })

/** Categories: /admin/api/v1/categories */
@Controller('admin/api/v1/categories')
@UseGuards(AdminGuard)
@UseInterceptors(AuditInterceptor)
export class CategoriesController implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly usage: UsageService,
    private readonly changeLog: ChangeLogService,
  ) {}

  onModuleInit() {
    this.changeLog.registerTarget('categories', async (id) => {
      const [c] = await this.db.select().from(categories).where(eq(categories.id, id))
      return c ? { record: await this.shape(c) } : null
    })
  }

  private async shape(c: Row) {
    return {
      id: c.id,
      name: c.name,
      ...(c.commissionRate !== null ? { commissionRate: c.commissionRate } : {}),
      ...(c.interestTablesPerMonth !== null ? { interestTablesPerMonth: c.interestTablesPerMonth } : {}),
      restaurantsCount: await this.usage.restaurantsInCategory(c.id),
      createdAt: c.createdAt,
      ...(c.updatedAt ? { updatedAt: c.updatedAt } : {}),
    }
  }

  private all() {
    return this.db.select().from(categories).orderBy(asc(categories.seq))
  }

  @Get()
  async list() {
    return Promise.all((await this.all()).map((c) => this.shape(c)))
  }

  @Get('active')
  async active() {
    return { success: true, data: { items: (await this.all()).map(({ id, name }) => ({ id, name })) } }
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const [c] = await this.db.select().from(categories).where(eq(categories.id, id))
    if (!c) throw notFound()
    return this.shape(c)
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: CategoryBody) {
    const name = String(body.name ?? '')
    if ((await this.all()).some((c) => c.name.toLowerCase() === name.toLowerCase())) throw nameInUse(body.name)
    const [c] = await this.db
      .insert(categories)
      .values({
        id: stampId('c'),
        name,
        commissionRate: body.commissionRate ?? null,
        interestTablesPerMonth: body.interestTablesPerMonth ?? null,
        createdAt: new Date().toISOString(),
      })
      .returning()
    return this.shape(c)
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: CategoryBody) {
    const rows = await this.all()
    const existing = rows.find((c) => c.id === id)
    if (!existing) throw notFound()
    if (body.name && rows.some((c) => c.id !== id && c.name.toLowerCase() === String(body.name).toLowerCase())) {
      throw nameInUse(body.name)
    }
    const changes: Partial<Row> = {}
    if (body.name !== undefined) changes.name = body.name
    if (body.commissionRate !== undefined) changes.commissionRate = body.commissionRate
    if (body.interestTablesPerMonth !== undefined) changes.interestTablesPerMonth = body.interestTablesPerMonth
    const [c] = Object.keys(changes).length
      ? await this.db.update(categories).set(changes).where(eq(categories.id, id)).returning()
      : [existing]
    return this.shape(c)
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Res() res: Response) {
    const [c] = await this.db.select().from(categories).where(eq(categories.id, id))
    if (!c) throw notFound()
    const restaurantsCount = await this.usage.restaurantsInCategory(id)
    if (restaurantsCount > 0) {
      throw apiError(409, 'ERR_CATEGORY_IN_USE', 'Cannot delete category. Reassign all restaurants first.', { restaurantsCount })
    }
    await this.db.delete(categories).where(eq(categories.id, id))
    res.status(204).end()
  }
}
