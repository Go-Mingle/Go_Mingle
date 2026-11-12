import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, ne } from 'drizzle-orm'
import { config } from '../../config'
import { DB, type Db } from '../../db/database'
import { adminUsers, emailLog, emailTemplates, partnerUsers, roles } from '../../db/schema'
import { apiError } from '../../common/errors'
import { TEMPLATE_DEFAULTS, templateDefault, type TemplateDefault } from './catalog'
import { deliver, type Delivery, type Recipient } from './mail-transport'
import { placeholdersIn, renderEmail, type RenderedEmail, type TemplateContent } from './render'

export type TemplateRow = typeof emailTemplates.$inferSelect

/** Links every email can use, whatever the template. */
const links = (): Record<string, string> => ({
  partnerPortalUrl: config.partnerPortalUrl,
  adminPortalUrl: config.adminPortalUrl,
  approvalUrl: `${config.adminPortalUrl}/approval-queue`,
})

const MAX = { subject: 200, heading: 120, body: 5000, buttonLabel: 40 }

/**
 * Email templates and sending. Every email GoMingle sends goes through
 * `send()`: the stored template is filled in, delivered by the configured
 * provider and recorded in the email log. Sending never throws, so a mail
 * outage cannot block the action that triggered the email.
 */
@Injectable()
export class MailService {
  private ensured = false

  constructor(@Inject(DB) private readonly db: Db) {}

  /** Creates any template row that is missing, from its default. */
  private async ensureTemplates(): Promise<void> {
    if (this.ensured) return
    await this.db
      .insert(emailTemplates)
      .values(TEMPLATE_DEFAULTS.map((t) => ({ key: t.key, subject: t.subject, heading: t.heading, body: t.body, buttonLabel: t.buttonLabel, enabled: true })))
      .onConflictDoNothing()
    this.ensured = true
  }

  async rows(): Promise<TemplateRow[]> {
    await this.ensureTemplates()
    return this.db.select().from(emailTemplates)
  }

  async row(key: string): Promise<TemplateRow | null> {
    if (!templateDefault(key)) return null
    await this.ensureTemplates()
    const [row] = await this.db.select().from(emailTemplates).where(eq(emailTemplates.key, key))
    return row ?? null
  }

  /** The admin-facing shape of one template. */
  view(def: TemplateDefault, row: TemplateRow) {
    return {
      key: def.key,
      audience: def.audience,
      name: def.name,
      description: def.description,
      required: def.required,
      placeholders: def.placeholders.map(({ name, description }) => ({ name, description })),
      hasButton: def.buttonUrl !== null,
      subject: row.subject,
      heading: row.heading,
      body: row.body,
      buttonLabel: row.buttonLabel,
      enabled: def.required ? true : row.enabled,
      isDefault:
        row.subject === def.subject && row.heading === def.heading && row.body === def.body && row.buttonLabel === def.buttonLabel,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    }
  }

  /** Checks edited content; throws 422 with field messages. */
  validate(def: TemplateDefault, content: Partial<TemplateContent>): TemplateContent {
    const fields: Record<string, string> = {}
    const allowed = new Set([...def.placeholders.map((p) => p.name)])
    const out = {} as TemplateContent
    for (const field of ['subject', 'heading', 'body', 'buttonLabel'] as const) {
      const value = String(content[field] ?? '').trim()
      out[field] = value
      if (!value && field !== 'buttonLabel') fields[field] = 'This field is required.'
      else if (value.length > MAX[field]) fields[field] = `Keep it under ${MAX[field]} characters.`
      else {
        const unknown = [...new Set(placeholdersIn(value).filter((n) => !allowed.has(n)))]
        if (unknown.length) fields[field] = `Unknown placeholder${unknown.length > 1 ? 's' : ''}: ${unknown.map((n) => `{{${n}}}`).join(', ')}.`
      }
    }
    if (def.placeholders.some((p) => p.name === 'code') && !placeholdersIn(out.body).includes('code')) {
      fields.body ??= 'The body must include {{code}}, or the code never reaches the person.'
    }
    if (Object.keys(fields).length) throw apiError(422, 'ERR_VALIDATION', Object.values(fields)[0], { fields })
    return out
  }

  /** Renders content with the template's sample values (preview and test send). */
  renderSample(def: TemplateDefault, content: TemplateContent): RenderedEmail {
    const values = { ...Object.fromEntries(def.placeholders.map((p) => [p.name, p.sample])), ...links() }
    return renderEmail(content, values, def.buttonUrl ? values[def.buttonUrl] : null)
  }

  async update(key: string, content: Partial<TemplateContent> & { enabled?: unknown }, by: string) {
    const def = templateDefault(key)
    const row = await this.row(key)
    if (!def || !row) return null
    const next = this.validate(def, { subject: row.subject, heading: row.heading, body: row.body, buttonLabel: row.buttonLabel, ...content })
    const enabled = def.required ? true : typeof content.enabled === 'boolean' ? content.enabled : row.enabled
    const [saved] = await this.db
      .update(emailTemplates)
      .set({ ...next, enabled, updatedAt: new Date().toISOString(), updatedBy: by })
      .where(eq(emailTemplates.key, key))
      .returning()
    return this.view(def, saved)
  }

  async restore(key: string, by: string) {
    const def = templateDefault(key)
    if (!def || !(await this.row(key))) return null
    const [saved] = await this.db
      .update(emailTemplates)
      .set({ subject: def.subject, heading: def.heading, body: def.body, buttonLabel: def.buttonLabel, updatedAt: new Date().toISOString(), updatedBy: by })
      .where(eq(emailTemplates.key, key))
      .returning()
    return this.view(def, saved)
  }

  async log(limit = 50) {
    const rows = await this.db.select().from(emailLog).orderBy(desc(emailLog.id)).limit(limit)
    const names = new Map(TEMPLATE_DEFAULTS.map((t) => [t.key, t.name]))
    return rows.map((r) => ({
      id: r.id,
      templateKey: r.templateKey,
      templateName: names.get(r.templateKey) ?? (r.templateKey === 'test' ? 'Test email' : r.templateKey),
      to: r.toEmail,
      subject: r.subject,
      status: r.status,
      error: r.error,
      createdAt: r.createdAt,
    }))
  }

  private async record(key: string, to: string, subject: string, d: Delivery | { status: 'SKIPPED'; provider: string }) {
    await this.db.insert(emailLog).values({
      templateKey: key,
      toEmail: to,
      subject,
      status: d.status,
      provider: d.provider,
      providerMessageId: 'messageId' in d ? (d.messageId ?? null) : null,
      error: 'error' in d ? (d.error ?? null) : null,
      createdAt: new Date().toISOString(),
    })
  }

  /** Sends an already-rendered email (the admin's test send) and logs it. */
  async sendRendered(key: string, to: Recipient, email: RenderedEmail, category: string): Promise<Delivery> {
    const d = await deliver(to, email, category)
    await this.record(key, to.email, email.subject, d).catch(() => undefined)
    if (d.status === 'FAILED') console.error(`[mail] ${key} to ${to.email} failed: ${d.error}`)
    return d
  }

  /**
   * Sends the template `key` to `to`, filled with `values`. Returns the
   * outcome; never throws.
   */
  async send(key: string, to: Recipient, values: Record<string, string | number | null | undefined>): Promise<Delivery | null> {
    try {
      const def = templateDefault(key)
      const row = await this.row(key)
      if (!def || !row || !to.email) return null
      const filled = Object.fromEntries(Object.entries({ ...links(), ...values }).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)]))
      const email = renderEmail(row, filled, def.buttonUrl ? filled[def.buttonUrl] : null)
      if (!def.required && !row.enabled) {
        await this.record(key, to.email, email.subject, { status: 'SKIPPED', provider: 'none' })
        return null
      }
      return await this.sendRendered(key, to, email, key)
    } catch (err) {
      console.error(`[mail] ${key} could not be prepared:`, err)
      return null
    }
  }

  /** Sends to a restaurant's owner (the partner who signed up). */
  async toRestaurantOwner(restaurantId: string, key: string, values: Record<string, string | number | null | undefined>) {
    const [owner] = await this.db
      .select()
      .from(partnerUsers)
      .where(and(eq(partnerUsers.restaurantId, restaurantId), eq(partnerUsers.isPrimary, true), ne(partnerUsers.status, 'DELETED')))
    if (!owner) return null
    return this.send(key, { email: owner.email, name: owner.fullName }, { name: owner.fullName, ...values })
  }

  /** Sends to every active admin who can review restaurant applications. */
  async toApprovers(key: string, values: Record<string, string | number | null | undefined>) {
    const rows = await this.db
      .select({ email: adminUsers.email, fullName: adminUsers.fullName, fullAccess: roles.fullAccess, permissions: roles.permissions })
      .from(adminUsers)
      .innerJoin(roles, eq(roles.id, adminUsers.roleId))
      .where(eq(adminUsers.status, 'ACTIVE'))
    for (const r of rows) {
      if (r.fullAccess || (r.permissions ?? []).includes('RESTAURANT_APPROVALS')) {
        await this.send(key, { email: r.email, name: r.fullName }, { name: r.fullName, ...values })
      }
    }
  }
}
