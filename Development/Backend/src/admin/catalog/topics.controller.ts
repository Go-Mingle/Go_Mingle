import { Controller, Delete, Get, HttpCode, Inject, OnModuleInit, Param, Patch, Post, Res, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Response } from 'express'
import { asc, eq } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { interests, topics, type InterestSnapshot } from '../../db/schema'
import { rawError } from '../../common/errors'
import { Body, Query } from '../../common/http'
import { stampId } from '../../common/ids'
import { AuditInterceptor } from '../../shared/changelog/audit.interceptor'
import { ChangeLogService } from '../../shared/changelog/changelog.service'
import { UsageService } from '../../shared/usage.service'
import { AdminGuard } from '../access/admin.guard'
import { bucketObjectUrl } from '../uploads.controller'

type Row = typeof topics.$inferSelect
type TopicBody = { name?: string; description?: string | null; graphicKey?: string; interestIds?: string[] }

const notFound = () => rawError(404, { success: false, error: { code: 'ERR_TOPIC_NOT_FOUND' } })

/** Interest topics: /admin/api/v1/topics */
@Controller('admin/api/v1/topics')
@UseGuards(AdminGuard)
@UseInterceptors(AuditInterceptor)
export class TopicsController implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly usage: UsageService,
    private readonly changeLog: ChangeLogService,
  ) {}

  onModuleInit() {
    const lookup = async (id: string) => {
      const [t] = await this.db.select().from(topics).where(eq(topics.id, id))
      return t ? { record: await this.shape(t) } : null
    }
    this.changeLog.registerTarget('topics', lookup)
    this.changeLog.registerTarget('interest-topics', lookup)
  }

  private async shape(t: Row) {
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      graphicUrl: t.graphicUrl,
      interests: t.interests,
      interestTablesCount: await this.usage.interestTablesForTopic(t.id),
      createdAt: t.createdAt,
    }
  }

  /** The interests behind the ids, as they are now, in the order given. */
  private async snapshot(ids: string[]): Promise<InterestSnapshot[]> {
    const rows = await this.db.select().from(interests)
    return ids
      .map((id) => rows.find((i) => i.id === id))
      .filter((i) => i !== undefined)
      .map((i) => ({ id: i.id, name: i.name, groupName: i.groupName, createdAt: i.createdAt, updatedAt: i.updatedAt }))
  }

  @Get()
  async list(@Query() q: Record<string, string>) {
    const page = Math.max(1, parseInt(q.page ?? '1', 10))
    const rawSize = parseInt(q.pageSize ?? '25', 10)
    const pageSize = [25, 50, 100].includes(rawSize) ? rawSize : 25
    const search = (q.q ?? '').toLowerCase()
    const asc_ = q.sortOrder !== 'desc'

    let rows = await this.db.select().from(topics).orderBy(asc(topics.seq))
    if (search) rows = rows.filter((t) => t.name.toLowerCase().includes(search))
    rows.sort((a, b) => (asc_ ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)))
    const totalRecords = rows.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    const items = await Promise.all(rows.slice((page - 1) * pageSize, page * pageSize).map((t) => this.shape(t)))
    return { success: true, data: { items, pagination: { page, pageSize, totalRecords, totalPages } } }
  }

  @Get('active')
  async active() {
    const rows = await this.db.select().from(topics).orderBy(asc(topics.seq))
    return { success: true, data: { items: rows.map((t) => ({ id: t.id, name: t.name, graphicUrl: t.graphicUrl })) } }
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const [t] = await this.db.select().from(topics).where(eq(topics.id, id))
    if (!t) throw notFound()
    return { success: true, data: await this.shape(t) }
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: TopicBody) {
    const [t] = await this.db
      .insert(topics)
      .values({
        id: stampId('t'),
        name: body.name ?? '',
        description: body.description ?? null,
        graphicUrl: body.graphicKey ? bucketObjectUrl(body.graphicKey) : null,
        interests: await this.snapshot(body.interestIds ?? []),
        createdAt: new Date().toISOString(),
      })
      .returning()
    return { success: true, data: await this.shape(t) }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: TopicBody) {
    const [existing] = await this.db.select().from(topics).where(eq(topics.id, id))
    if (!existing) throw notFound()
    const changes: Partial<Row> = {}
    if (body.name !== undefined) changes.name = body.name
    if (body.description !== undefined) changes.description = body.description
    // Edit sends `graphicKey` only when the image was replaced.
    if (body.graphicKey !== undefined) changes.graphicUrl = bucketObjectUrl(body.graphicKey)
    if (body.interestIds) changes.interests = await this.snapshot(body.interestIds)
    const [t] = Object.keys(changes).length ? await this.db.update(topics).set(changes).where(eq(topics.id, id)).returning() : [existing]
    return { success: true, data: await this.shape(t) }
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Res() res: Response) {
    await this.db.delete(topics).where(eq(topics.id, id))
    res.status(204).end()
  }
}
