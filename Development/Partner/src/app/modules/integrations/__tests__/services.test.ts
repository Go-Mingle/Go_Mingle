import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import {
  clearMockWebhookConfig,
  resetMockWebhooks,
  setMockTestRecordDelay,
} from '../../../../mocks/data/webhooks'
import { HttpError } from '../../../../shared/api/httpClient'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { WEBHOOK_ENDPOINTS } from '../constants'
import { webhooksService } from '../services'

beforeEach(() => {
  resetMockWebhooks()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('webhooksService.getConfig', () => {
  it('returns the config with both secrets masked', async () => {
    const config = await webhooksService.getConfig()
    expect(config.endpointUrl).toContain('https://')
    expect(config.bearerTokenMasked).toBeTruthy()
    expect(config.configured).toBe(true)
  })

  /** BR-04 / AC-02.3 — the signing secret is unreadable after generation. */
  it('never returns the signing secret in full, even when revealing', async () => {
    expect((await webhooksService.getConfig()).signingSecret).toBeNull()
    expect((await webhooksService.getConfig(true)).signingSecret).toBeNull()
  })

  it('withholds the plaintext bearer token by default', async () => {
    expect((await webhooksService.getConfig()).bearerToken).toBeNull()
  })

  it('reveals the plaintext bearer token on request (BR-16)', async () => {
    const revealed = await webhooksService.getConfig(true)
    expect(revealed.bearerToken).toBe('pos_live_a1b2c3d4e5f6g7h8i9j0')
  })

  it('asks for the reveal with an explicit query flag', async () => {
    let seen = ''
    server.use(
      http.get(WEBHOOK_ENDPOINTS.config, ({ request }) => {
        seen = new URL(request.url).search
        return HttpResponse.json({ success: true, data: {} })
      }),
    )
    await webhooksService.getConfig(true)
    expect(seen).toBe('?reveal=true')

    await webhooksService.getConfig()
    expect(seen).toBe('')
  })

  it('reports the unconfigured state with every field null (AC-01.1)', async () => {
    clearMockWebhookConfig()
    const config = await webhooksService.getConfig()
    expect(config).toMatchObject({
      endpointUrl: null,
      bearerTokenMasked: null,
      signingSecretMasked: null,
      enabled: false,
      configured: false,
    })
  })

  it('throws on a 500', async () => {
    server.use(http.get(WEBHOOK_ENDPOINTS.config, () => HttpResponse.json({}, { status: 500 })))
    await expect(webhooksService.getConfig()).rejects.toBeInstanceOf(HttpError)
  })
})

describe('webhooksService.saveConfig', () => {
  const valid = {
    endpointUrl: 'https://api.aurelia-pos.com/hooks/gomingle',
    bearerToken: 'pos_live_token',
  }

  it('saves the endpoint and token', async () => {
    const saved = await webhooksService.saveConfig(valid)
    expect(saved.endpointUrl).toBe(valid.endpointUrl)
    expect(saved.configured).toBe(true)
  })

  it('rejects a non-HTTPS endpoint (BR-02)', async () => {
    await expect(
      webhooksService.saveConfig({ ...valid, endpointUrl: 'http://insecure.example.com/hooks' }),
    ).rejects.toMatchObject({ status: 422 })
  })

  /**
   * MET-1282 — the API refuses an unresolvable host too, so a client that skips
   * the inline check still cannot configure an endpoint nothing can reach.
   */
  it('rejects an https endpoint whose host has no TLD', async () => {
    await expect(
      webhooksService.saveConfig({ ...valid, endpointUrl: 'https://no-tld' }),
    ).rejects.toMatchObject({ status: 422 })

    const config = await webhooksService.getConfig()
    expect(config.endpointUrl).not.toBe('https://no-tld')
  })

  it('rejects an empty bearer token (BR-03)', async () => {
    await expect(webhooksService.saveConfig({ ...valid, bearerToken: '' })).rejects.toMatchObject({
      status: 422,
    })
  })

  it('returns the generated secret in full on the first save only (BR-04)', async () => {
    clearMockWebhookConfig()
    const first = await webhooksService.saveConfig(valid)
    expect(first.signingSecret).toMatch(/^whsec_/)

    const second = await webhooksService.saveConfig(valid)
    expect(second.signingSecret).toBeNull()
  })

  it('leaves the toggle alone when `enabled` is omitted', async () => {
    // A live integration must not be muted by an ordinary URL edit.
    await webhooksService.saveConfig(valid)
    expect((await webhooksService.getConfig()).enabled).toBe(true)
  })

  it('mutes delivery when `enabled: false` is sent explicitly (BR-08)', async () => {
    await webhooksService.saveConfig({ ...valid, enabled: false })
    expect((await webhooksService.getConfig()).enabled).toBe(false)
  })

  it('sends no `enabled` key at all when the caller omits it', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.put(WEBHOOK_ENDPOINTS.config, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ success: true, data: {} })
      }),
    )
    await webhooksService.saveConfig(valid)
    expect('enabled' in body).toBe(false)
  })
})

describe('webhooksService.rotateSecret', () => {
  it('returns a new full secret, its mask and the rotation time (BR-05)', async () => {
    const result = await webhooksService.rotateSecret()
    expect(result.signingSecret).toMatch(/^whsec_/)
    expect(result.signingSecretMasked).toMatch(/^whsec_••••/)
    expect(result.secretRotatedAt).toBeTruthy()
  })

  it('replaces the live mask so the partner can confirm the rotation took effect', async () => {
    const before = (await webhooksService.getConfig()).signingSecretMasked
    const rotated = await webhooksService.rotateSecret()
    expect(rotated.signingSecretMasked).not.toBe(before)
    expect((await webhooksService.getConfig()).signingSecretMasked).toBe(
      rotated.signingSecretMasked,
    )
  })

  it('409s with ERR_NOT_CONFIGURED before anything is saved', async () => {
    clearMockWebhookConfig()
    await expect(webhooksService.rotateSecret()).rejects.toMatchObject({
      status: 409,
      code: 'ERR_NOT_CONFIGURED',
    })
  })
})

describe('webhooksService.sendTest', () => {
  it('resolves with queued — a 202, not a delivery result', async () => {
    await expect(webhooksService.sendTest('BOOKING_CREATED')).resolves.toEqual({
      queued: true,
      eventType: 'BOOKING_CREATED',
    })
  })

  it('works while the toggle is OFF (AC-05.2)', async () => {
    await webhooksService.saveConfig({
      endpointUrl: 'https://api.aurelia-pos.com/hooks/gomingle',
      bearerToken: 'pos_live_token',
      enabled: false,
    })
    await expect(webhooksService.sendTest('BOOKING_CONFIRMED')).resolves.toMatchObject({
      queued: true,
    })
  })

  /**
   * MET-1277 — the 202 is an acceptance, not a write. The record is F2's to
   * make, and the log genuinely does not have it yet at this point.
   */
  it('is not in the log the instant the 202 lands', async () => {
    await webhooksService.sendTest('BOOKING_COMPLETED')
    const page = await webhooksService.getDeliveries()
    expect(page.items.some((row) => row.isTest)).toBe(false)
  })

  it('shows up in the log labelled as a test once recorded (BR-12)', async () => {
    setMockTestRecordDelay(0)
    await webhooksService.sendTest('BOOKING_COMPLETED')
    const page = await webhooksService.getDeliveries()
    expect(page.items[0]).toMatchObject({ eventType: 'BOOKING_COMPLETED', isTest: true })
  })

  it('409s with ERR_NOT_CONFIGURED before anything is saved (AC-05.3)', async () => {
    clearMockWebhookConfig()
    await expect(webhooksService.sendTest('BOOKING_CREATED')).rejects.toMatchObject({
      status: 409,
      code: 'ERR_NOT_CONFIGURED',
    })
  })

  it('422s on an unknown event type', async () => {
    await expect(
      webhooksService.sendTest('NOT_AN_EVENT' as 'BOOKING_CREATED'),
    ).rejects.toMatchObject({ status: 422 })
  })
})

describe('webhooksService.getDeliveries', () => {
  it('returns items plus pagination', async () => {
    const page = await webhooksService.getDeliveries()
    expect(page.items.length).toBeGreaterThan(0)
    expect(page.pagination.totalRecords).toBeGreaterThan(0)
  })

  it('serialises page, pageSize and status', async () => {
    let seen = ''
    server.use(
      http.get(WEBHOOK_ENDPOINTS.deliveries, ({ request }) => {
        seen = new URL(request.url).search
        return HttpResponse.json({
          success: true,
          data: { items: [], pagination: { page: 1, pageSize: 8, totalRecords: 0, totalPages: 1 } },
        })
      }),
    )
    await webhooksService.getDeliveries({ page: 2, pageSize: 8, status: 'FAILED' })
    expect(seen).toBe('?page=2&pageSize=8&status=FAILED')
  })

  it('omits every param when none are given', async () => {
    let seen = 'unset'
    server.use(
      http.get(WEBHOOK_ENDPOINTS.deliveries, ({ request }) => {
        seen = new URL(request.url).search
        return HttpResponse.json({
          success: true,
          data: { items: [], pagination: { page: 1, pageSize: 8, totalRecords: 0, totalPages: 1 } },
        })
      }),
    )
    await webhooksService.getDeliveries()
    expect(seen).toBe('')
  })

  it('filters to both terminal states under FAILED', async () => {
    const page = await webhooksService.getDeliveries({ status: 'FAILED', pageSize: 25 })
    const statuses = page.items.map((d) => d.status)
    expect(statuses).toContain('FAILED_EMAILED')
    expect(statuses).toContain('FAILED')
    expect(statuses).not.toContain('DELIVERED')
  })

  it('filters to DELIVERED only', async () => {
    const page = await webhooksService.getDeliveries({ status: 'DELIVERED', pageSize: 25 })
    expect(page.items.every((d) => d.status === 'DELIVERED')).toBe(true)
  })

  it('falls back to the default view on a nonsense status rather than 400ing', async () => {
    const page = await webhooksService.getDeliveries({ status: 'GARBAGE' as 'ALL', pageSize: 25 })
    expect(page.items.length).toBeGreaterThan(0)
  })

  it('paginates', async () => {
    const first = await webhooksService.getDeliveries({ page: 1, pageSize: 2 })
    const second = await webhooksService.getDeliveries({ page: 2, pageSize: 2 })
    expect(first.items).toHaveLength(2)
    expect(first.pagination.totalPages).toBeGreaterThan(1)
    expect(second.items[0]?.occurredAt).not.toBe(first.items[0]?.occurredAt)
  })

  it('throws on a 500', async () => {
    server.use(http.get(WEBHOOK_ENDPOINTS.deliveries, () => HttpResponse.json({}, { status: 500 })))
    await expect(webhooksService.getDeliveries()).rejects.toBeInstanceOf(HttpError)
  })
})
