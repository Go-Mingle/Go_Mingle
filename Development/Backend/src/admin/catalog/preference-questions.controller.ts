import { Controller, Delete, Get, HttpCode, Inject, OnModuleInit, Param, Patch, Post, Res, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Response } from 'express'
import { and, asc, eq, gte, ne, sql } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { preferenceOptions, preferenceQuestions } from '../../db/schema'
import { apiError } from '../../common/errors'
import { Body, Query } from '../../common/http'
import { stampId } from '../../common/ids'
import { AuditInterceptor } from '../../shared/changelog/audit.interceptor'
import { ChangeLogService } from '../../shared/changelog/changelog.service'
import { AdminGuard } from '../access/admin.guard'

type Row = typeof preferenceQuestions.$inferSelect
type OptionInput = { id?: string; text: string }
type QuestionBody = { question?: string; type?: string; questionOrder?: number; options?: OptionInput[] }

const notFound = () => apiError(404, 'ERR_QUESTION_NOT_FOUND', 'Question not found.', {})
const textInUse = () => apiError(409, 'ERR_QUESTION_TEXT_IN_USE', 'A question with this text already exists.', {})
const tooFewOptions = () => apiError(400, 'ERR_INSUFFICIENT_OPTIONS', 'At least two options are required.', {})

/** Preference questions (Mingler onboarding): /admin/api/v1/preference-questions */
@Controller('admin/api/v1/preference-questions')
@UseGuards(AdminGuard)
@UseInterceptors(AuditInterceptor)
export class PreferenceQuestionsController implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly changeLog: ChangeLogService,
  ) {}

  onModuleInit() {
    this.changeLog.registerTarget('preference-questions', async (id) => {
      const [q] = await this.db.select().from(preferenceQuestions).where(eq(preferenceQuestions.id, id))
      return q ? { record: await this.listItem(q) } : null
    })
  }

  private async options(questionId: string) {
    const rows = await this.db
      .select()
      .from(preferenceOptions)
      .where(eq(preferenceOptions.questionId, questionId))
      .orderBy(asc(preferenceOptions.position))
    return rows.map((o) => ({ id: o.id, text: o.text, displayOrder: o.displayOrder }))
  }

  private async listItem(q: Row) {
    return {
      id: q.id,
      question: q.question,
      type: q.type,
      questionOrder: q.questionOrder,
      optionsCount: await this.db.$count(preferenceOptions, eq(preferenceOptions.questionId, q.id)),
      createdAt: q.createdAt,
    }
  }

  private all() {
    return this.db.select().from(preferenceQuestions).orderBy(asc(preferenceQuestions.seq))
  }

  @Get()
  async list(@Query() q: Record<string, string>) {
    const search = (q.q ?? '').toLowerCase()
    const page = Math.max(1, Number(q.page ?? '1'))
    const rawPageSize = Number(q.pageSize ?? '10')
    const pageSize = [10, 25, 50].includes(rawPageSize) ? rawPageSize : 10
    const sortBy = q.sortBy ?? 'order'
    const dir = (q.sortOrder ?? 'asc') === 'asc' ? 1 : -1

    let rows = await this.all()
    if (search) rows = rows.filter((r) => r.question.toLowerCase().includes(search))
    rows.sort((a, b) => (sortBy === 'question' ? a.question.localeCompare(b.question) * dir : (a.questionOrder - b.questionOrder) * dir))

    const totalRecords = rows.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * pageSize
    const items = await Promise.all(rows.slice(start, start + pageSize).map((r) => this.listItem(r)))
    return { success: true, data: { items, pagination: { page: safePage, pageSize, totalRecords, totalPages } } }
  }

  @Get('active')
  async active() {
    const items = await Promise.all((await this.all()).map(async (r) => ({ ...(await this.listItem(r)), options: await this.options(r.id) })))
    return { success: true, data: { items } }
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: QuestionBody) {
    const question = String(body.question ?? '')
    if ((await this.all()).some((r) => r.question.toLowerCase() === question.toLowerCase())) throw textInUse()
    if (!body.options || body.options.length < 2) throw tooFewOptions()
    const order = Number(body.questionOrder)
    const options = body.options
    const id = stampId('pq')
    const now = new Date().toISOString()
    await this.db.transaction(async (tx) => {
      // Make room: questions at or after the new position move down by one.
      await tx
        .update(preferenceQuestions)
        .set({ questionOrder: sql`${preferenceQuestions.questionOrder} + 1` })
        .where(gte(preferenceQuestions.questionOrder, order))
      await tx.insert(preferenceQuestions).values({ id, question, type: body.type ?? null, questionOrder: order, createdAt: now })
      await tx
        .insert(preferenceOptions)
        .values(options.map((opt, i) => ({ id: `${id}-opt${i + 1}`, questionId: id, position: i, text: opt.text, displayOrder: i })))
    })
    return {
      success: true,
      data: { id, question, type: body.type, questionOrder: body.questionOrder, optionsCount: options.length, createdAt: now, updatedAt: null },
    }
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const [q] = await this.db.select().from(preferenceQuestions).where(eq(preferenceQuestions.id, id))
    if (!q) throw notFound()
    return {
      success: true,
      data: { id: q.id, question: q.question, type: q.type, questionOrder: q.questionOrder, options: await this.options(id), createdAt: q.createdAt, updatedAt: null },
    }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: QuestionBody) {
    const rows = await this.all()
    const current = rows.find((r) => r.id === id)
    if (!current) throw notFound()
    if (body.question !== undefined && rows.some((r) => r.id !== id && r.question.toLowerCase() === String(body.question).toLowerCase())) {
      throw textInUse()
    }
    if (body.options !== undefined && body.options.length < 2) throw tooFewOptions()

    const updated = {
      question: body.question ?? current.question,
      type: body.type ?? current.type,
      questionOrder: body.questionOrder ?? current.questionOrder,
    }
    const existing = await this.options(id)
    await this.db.transaction(async (tx) => {
      if (body.questionOrder !== undefined && body.questionOrder !== current.questionOrder) {
        await tx
          .update(preferenceQuestions)
          .set({ questionOrder: sql`${preferenceQuestions.questionOrder} + 1` })
          .where(and(ne(preferenceQuestions.id, id), gte(preferenceQuestions.questionOrder, body.questionOrder)))
      }
      await tx.update(preferenceQuestions).set(updated).where(eq(preferenceQuestions.id, id))
      if (body.options !== undefined) {
        await tx.delete(preferenceOptions).where(eq(preferenceOptions.questionId, id))
        await tx.insert(preferenceOptions).values(
          body.options.map((opt, i) => {
            // A kept option keeps its display order; a new one takes its position.
            const match = opt.id ? existing.find((o) => o.id === opt.id) : undefined
            return {
              id: opt.id ?? `${id}-opt-new${i}`,
              questionId: id,
              position: i,
              text: opt.text,
              displayOrder: match ? match.displayOrder : i,
            }
          }),
        )
      }
    })
    return {
      success: true,
      data: {
        id,
        ...updated,
        optionsCount: body.options ? body.options.length : existing.length,
        updatedAt: new Date().toISOString(),
      },
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Res() res: Response) {
    const [q] = await this.db.delete(preferenceQuestions).where(eq(preferenceQuestions.id, id)).returning()
    if (!q) throw notFound()
    await this.db.delete(preferenceOptions).where(eq(preferenceOptions.questionId, id))
    res.status(204).end()
  }
}
