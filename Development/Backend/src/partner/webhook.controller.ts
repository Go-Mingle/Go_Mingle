import crypto from 'node:crypto'
import { Controller, Get, HttpCode, Inject, Post, Put, UseGuards } from '@nestjs/common'
import { and, desc, eq } from 'drizzle-orm'
import { DB, type Db } from '../db/database'
import { webhookConfigs, webhookDeliveries } from '../db/schema'
import { apiError } from '../common/errors'
import { Body, Query } from '../common/http'
import { CurrentPartner, PartnerGuard } from './access/partner.guard'
import type { PartnerUser } from './access/partner-accounts.service'

type Config = typeof webhookConfigs.$inferSelect
type Json = Record<string, unknown>

const fail = (status: number, code: string, message: string) => apiError(status, code, message, null)
const notConfigured = () => fail(409, 'ERR_NOT_CONFIGURED', 'Save your endpoint and bearer token first.')

const BEARER_MASK = '••••••••••••'
const TEST_VISIBLE_AFTER_MS = 4_000
const EVENT_TYPES = [
  'INTEREST_TABLE_PUBLISHED',
  'INTEREST_TABLE_UPDATED',
  'INTEREST_TABLE_CANCELLED',
  'BOOKING_CREATED',
  'BOOKING_CONFIRMED',
  'BOOKING_COMPLETED',
  'BOOKING_CANCELLED',
]
const DOTTED_HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i
const IPV4_HOST = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/
const IPV6_HOST = /^\[[0-9a-f:.]+\]$/i
const deliverableHost = (host: string) => DOTTED_HOST.test(host) || IPV4_HOST.test(host) || IPV6_HOST.test(host)

const maskSecret = (secret: string | null) => (secret ? `whsec_••••${secret.slice(-4)}` : null)
const newSecret = () => `whsec_${crypto.randomBytes(16).toString('hex')}`

/** `BOOKING_CREATED` → `Booking · Created` */
function eventLabel(type: string): string {
  const booking = type.startsWith('BOOKING_')
  const name = type.slice((booking ? 'BOOKING_' : 'INTEREST_TABLE_').length).toLowerCase()
  return `${booking ? 'Booking' : 'Interest table'} · ${name.charAt(0).toUpperCase()}${name.slice(1)}`
}

/**
 * Integrations: the restaurant's webhook endpoint and its delivery log.
 * /partner/api/v1/partner/webhook
 *
 * The secrets are shown in full exactly once (the signing secret when it is
 * created or rotated; the bearer token only on `?reveal=true`).
 * TODO(go-live): a test currently records the delivery without posting to the
 * endpoint; the sender (signing, retries, failure emails) is go-live work.
 */
@Controller('partner/api/v1/partner/webhook')
@UseGuards(PartnerGuard)
export class WebhookController {
  constructor(@Inject(DB) private readonly db: Db) {}

  private async config(restaurantId: string): Promise<Config | null> {
    const [row] = await this.db.select().from(webhookConfigs).where(eq(webhookConfigs.restaurantId, restaurantId))
    return row ?? null
  }

  private view(c: Config | null, reveal = false) {
    const configured = Boolean(c?.endpointUrl && c?.bearerToken)
    return {
      endpointUrl: c?.endpointUrl ?? null,
      bearerTokenMasked: configured ? BEARER_MASK : null,
      bearerToken: reveal && configured ? (c?.bearerToken ?? null) : null,
      signingSecretMasked: maskSecret(c?.signingSecret ?? null),
      signingSecret: null as string | null,
      enabled: c?.enabled ?? false,
      configured,
      secretRotatedAt: c?.secretRotatedAt ?? null,
    }
  }

  /** Only a literal `reveal=true` shows the bearer token. */
  @Get()
  async get(@CurrentPartner() user: PartnerUser, @Query() q: Record<string, string>) {
    return { success: true, data: this.view(await this.config(user.restaurantId), q.reveal === 'true') }
  }

  @Put()
  async save(@CurrentPartner() user: PartnerUser, @Body() body: Json) {
    if ('signingSecret' in body || 'restaurantId' in body) throw fail(422, 'ERR_VALIDATION', 'Unexpected field.')
    const endpointUrl = String(body.endpointUrl ?? '').trim()
    const bearerToken = String(body.bearerToken ?? '').trim()
    let parsed: URL | null
    try {
      parsed = new URL(endpointUrl)
    } catch {
      parsed = null
    }
    if (parsed?.protocol !== 'https:' || endpointUrl.length > 2048) throw fail(422, 'ERR_VALIDATION', 'Endpoint URL must use HTTPS.')
    if (!deliverableHost(parsed.hostname)) {
      throw fail(422, 'ERR_VALIDATION', 'Enter a full hostname, for example https://api.yourdomain.com/hooks.')
    }
    if (!bearerToken || bearerToken.length > 500) {
      throw fail(422, 'ERR_VALIDATION', 'Bearer token is required — we never post to an unauthenticated endpoint.')
    }

    const existing = await this.config(user.restaurantId)
    // The signing secret is created on the first save and returned in full this once.
    const created = existing?.signingSecret ? null : newSecret()
    const values = {
      restaurantId: user.restaurantId,
      endpointUrl,
      bearerToken,
      signingSecret: created ?? existing?.signingSecret ?? null,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : (existing?.enabled ?? false),
      secretRotatedAt: existing?.secretRotatedAt ?? null,
    }
    const [saved] = await this.db.insert(webhookConfigs).values(values).onConflictDoUpdate({ target: webhookConfigs.restaurantId, set: values }).returning()
    return { success: true, data: { ...this.view(saved), signingSecret: created } }
  }

  @Post('rotate-secret')
  @HttpCode(200)
  async rotate(@CurrentPartner() user: PartnerUser) {
    const c = await this.config(user.restaurantId)
    if (!c?.endpointUrl || !c.bearerToken) throw notConfigured()
    const signingSecret = newSecret()
    const secretRotatedAt = new Date().toISOString()
    await this.db.update(webhookConfigs).set({ signingSecret, secretRotatedAt }).where(eq(webhookConfigs.restaurantId, user.restaurantId))
    return { success: true, data: { signingSecret, signingSecretMasked: maskSecret(signingSecret), secretRotatedAt } }
  }

  @Post('test')
  @HttpCode(202)
  async test(@CurrentPartner() user: PartnerUser, @Body() body: Json) {
    const c = await this.config(user.restaurantId)
    if (!c?.endpointUrl || !c.bearerToken) throw notConfigured()
    const eventType = String(body.eventType)
    if (!EVENT_TYPES.includes(eventType)) throw fail(422, 'ERR_VALIDATION', 'Unknown event type.')
    await this.db.insert(webhookDeliveries).values({
      restaurantId: user.restaurantId,
      eventType,
      occurredAt: new Date().toISOString(),
      status: 'DELIVERED',
      isTest: true,
      visibleFrom: Date.now() + TEST_VISIBLE_AFTER_MS,
    })
    return { success: true, data: { queued: true, eventType } }
  }

  /** Newest first. FAILED also covers deliveries whose failure was emailed. */
  @Get('deliveries')
  async deliveries(@CurrentPartner() user: PartnerUser, @Query() q: Record<string, string>) {
    const status = ['ALL', 'DELIVERED', 'RETRYING', 'FAILED'].includes(q.status ?? 'ALL') ? (q.status ?? 'ALL') : 'ALL'
    const size = Number(q.pageSize)
    const pageSize = Number.isInteger(size) && size > 0 ? size : 25
    const now = Date.now()
    const rows = (
      await this.db
        .select()
        .from(webhookDeliveries)
        .where(and(eq(webhookDeliveries.restaurantId, user.restaurantId)))
        .orderBy(desc(webhookDeliveries.seq))
    )
      .filter((d) => d.visibleFrom <= now)
      .filter((d) => status === 'ALL' || (status === 'FAILED' ? d.status === 'FAILED' || d.status === 'FAILED_EMAILED' : d.status === status))
    const totalRecords = rows.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    const wanted = Number(q.page)
    const page = Number.isInteger(wanted) && wanted >= 1 ? Math.min(wanted, totalPages) : 1
    const items = rows.slice((page - 1) * pageSize, page * pageSize).map((d) => ({
      eventType: d.eventType,
      eventLabel: eventLabel(d.eventType),
      tries: d.tries,
      reason: d.reason,
      whenRelative: relative(d.occurredAt),
      occurredAt: d.occurredAt,
      status: d.status,
      isTest: d.isTest,
    }))
    return { success: true, data: { items, pagination: { page, pageSize, totalRecords, totalPages } } }
  }
}

/** `just now`, `14m ago`, `2h ago`, `3d ago` */
function relative(iso: string): string {
  const minutes = Math.floor((Date.now() - Date.parse(iso)) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  return `${Math.floor(minutes / 1440)}d ago`
}
