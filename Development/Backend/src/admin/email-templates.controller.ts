import { Controller, Get, HttpCode, OnModuleInit, Param, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common'
import { apiError } from '../common/errors'
import { Body } from '../common/http'
import { AuditInterceptor, NoAudit } from '../shared/changelog/audit.interceptor'
import { ChangeLogService } from '../shared/changelog/changelog.service'
import { TEMPLATE_DEFAULTS, templateDefault } from '../shared/email/catalog'
import { MailService } from '../shared/email/mail.service'
import type { TemplateContent } from '../shared/email/render'
import { AdminGuard, CurrentAdmin } from './access/admin.guard'
import type { AdminSession } from './access/admin-accounts.service'

const notFound = () => apiError(404, 'ERR_NOT_FOUND', 'Email template not found.')

type Draft = Partial<TemplateContent> & { enabled?: unknown }

const pickDraft = (body: Record<string, unknown>): Draft => {
  const out: Draft = {}
  for (const k of ['subject', 'heading', 'body', 'buttonLabel'] as const) if (typeof body[k] === 'string') out[k] = body[k] as string
  if (typeof body.enabled === 'boolean') out.enabled = body.enabled
  return out
}

/** Configure → Email Templates: /admin/api/v1/email-templates */
@Controller('admin/api/v1/email-templates')
@UseGuards(AdminGuard)
@UseInterceptors(AuditInterceptor)
export class EmailTemplatesController implements OnModuleInit {
  constructor(
    private readonly mail: MailService,
    private readonly changeLog: ChangeLogService,
  ) {}

  onModuleInit() {
    this.changeLog.registerTarget('email-templates', async (key) => {
      const def = templateDefault(key)
      const row = def ? await this.mail.row(key) : null
      return def && row ? { name: def.name, record: { ...row, name: def.name } } : null
    })
  }

  @Get()
  async list() {
    const rows = new Map((await this.mail.rows()).map((r) => [r.key, r]))
    const data = TEMPLATE_DEFAULTS.filter((d) => rows.has(d.key)).map((d) => this.mail.view(d, rows.get(d.key)!))
    return { success: true, data }
  }

  @Get('log')
  async log() {
    return { success: true, data: await this.mail.log() }
  }

  @Get(':key')
  async one(@Param('key') key: string) {
    const def = templateDefault(key)
    const row = await this.mail.row(key)
    if (!def || !row) throw notFound()
    return { success: true, data: this.mail.view(def, row) }
  }

  @Patch(':key')
  async update(@Param('key') key: string, @Body() body: Record<string, unknown>, @CurrentAdmin() admin: AdminSession) {
    const data = await this.mail.update(key, pickDraft(body), admin.fullName)
    if (!data) throw notFound()
    return { success: true, data }
  }

  @Post(':key/reset')
  @HttpCode(200)
  async reset(@Param('key') key: string, @CurrentAdmin() admin: AdminSession) {
    const data = await this.mail.restore(key, admin.fullName)
    if (!data) throw notFound()
    return { success: true, data }
  }

  /** The email as it will arrive, with sample values. Takes unsaved edits. */
  @Post(':key/preview')
  @HttpCode(200)
  @NoAudit()
  async preview(@Param('key') key: string, @Body() body: Record<string, unknown>) {
    const def = templateDefault(key)
    const row = await this.mail.row(key)
    if (!def || !row) throw notFound()
    const content = this.mail.validate(def, { ...row, ...pickDraft(body) })
    return { success: true, data: this.mail.renderSample(def, content) }
  }

  /** Emails the (possibly unsaved) template with sample values to the signed-in admin. */
  @Post(':key/test')
  @HttpCode(200)
  @NoAudit()
  async test(@Param('key') key: string, @Body() body: Record<string, unknown>, @CurrentAdmin() admin: AdminSession) {
    const def = templateDefault(key)
    const row = await this.mail.row(key)
    if (!def || !row) throw notFound()
    const content = this.mail.validate(def, { ...row, ...pickDraft(body) })
    const email = this.mail.renderSample(def, content)
    const delivery = await this.mail.sendRendered(key, { email: admin.email, name: admin.fullName }, { ...email, subject: `[Test] ${email.subject}` }, 'test')
    if (delivery.status === 'FAILED') {
      throw apiError(502, 'ERR_EMAIL_FAILED', 'The test email could not be sent. Try again in a moment.', { reason: delivery.error })
    }
    return { success: true, data: { to: admin.email, status: delivery.status } }
  }
}
