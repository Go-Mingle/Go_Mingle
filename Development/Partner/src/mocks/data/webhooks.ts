import { HttpResponse } from 'msw'
import { isDeliverableWebhookHost } from '../../app/modules/integrations/endpointUrl'
import type {
  DeliveryStatus,
  DeliveryStatusFilter,
  WebhookConfig,
  WebhookDelivery,
  WebhookEventType,
} from '../../app/modules/integrations/types'

/**
 * In-memory J4 webhook state for the prototype.
 *
 * Seeded configured + active with a short delivery history so the module shows
 * its full UI on first open; mutated by the handlers so saves, rotations and
 * tests persist for the session.
 */

interface MockWebhookState {
  endpointUrl: string | null
  bearerToken: string | null
  signingSecret: string | null
  signingSecretMasked: string | null
  enabled: boolean
  secretRotatedAt: string | null
}

/** A short random hex suffix for masked/full signing secrets. */
function randHex(len: number): string {
  const chars = '0123456789abcdef'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

/** Generates a new signing secret; returns the full value and its masked form. */
export function generateSecret(): { full: string; masked: string } {
  const body = randHex(32)
  return { full: `whsec_${body}`, masked: `whsec_••••${body.slice(-4)}` }
}

function seedState(): MockWebhookState {
  return {
    endpointUrl: 'https://api.aurelia-pos.com/hooks/gomingle',
    bearerToken: 'pos_live_a1b2c3d4e5f6g7h8i9j0',
    signingSecret: 'whsec_seed0000000000000000000000003a9f',
    signingSecretMasked: 'whsec_••••3a9f',
    enabled: true,
    secretRotatedAt: null,
  }
}

export let mockWebhookState: MockWebhookState = seedState()

/** Bullet mask — its length says nothing about the real token. */
const BEARER_MASK = '••••••••••••'

const RELATIVE = ['2m ago', '14m ago', '1h ago', '2h ago', '3h ago', '1d ago']

interface MockDelivery extends WebhookDelivery {
  minutesAgo: number
  /**
   * MET-1277 — when F2 has finished writing this record. Rows are invisible to
   * the log until then.
   *
   * Seeded rows are already written, so this is only ever in the future for a
   * test send. Modelling the lag matters: the mock used to record a test send
   * synchronously, which is precisely why the UI's fire-once-and-forget
   * invalidation looked correct here while failing against the real worker.
   */
  recordedAt: number
}

/**
 * How long F2 takes to write a test delivery, in the mock. Short enough not to
 * stall a click, long enough that a refetch fired on the 202 misses it — which
 * is the behaviour under test.
 */
export const MOCK_TEST_RECORD_DELAY_MS = 4_000

let testRecordDelayMs = MOCK_TEST_RECORD_DELAY_MS

/**
 * Lets a test collapse F2's write lag to zero so it can assert on the recorded
 * row without waiting out the delay. Reset by {@link resetMockWebhooks}.
 */
export function setMockTestRecordDelay(ms: number): void {
  testRecordDelayMs = ms
}

function eventLabelFor(type: WebhookEventType): string {
  const isBooking = type.startsWith('BOOKING_')
  const streamLabel = isBooking ? 'Booking' : 'Interest table'
  const name = isBooking ? type.slice('BOOKING_'.length) : type.slice('INTEREST_TABLE_'.length)
  const lower = name.toLowerCase()
  return `${streamLabel} · ${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
}

function seedDeliveries(): MockDelivery[] {
  const rows: Array<[WebhookEventType, DeliveryStatus, number, string | null]> = [
    ['BOOKING_CREATED', 'DELIVERED', 1, null],
    ['INTEREST_TABLE_PUBLISHED', 'DELIVERED', 1, null],
    ['BOOKING_CANCELLED', 'RETRYING', 2, 'endpoint 5xx'],
    ['BOOKING_CONFIRMED', 'DELIVERED', 1, null],
    ['INTEREST_TABLE_PUBLISHED', 'FAILED_EMAILED', 10, 'conn timeout'],
    // Terminal *and* the email fallback failed — must not read as "emailed".
    ['INTEREST_TABLE_CANCELLED', 'FAILED', 10, 'conn refused'],
    ['BOOKING_COMPLETED', 'DELIVERED', 1, null],
    ['INTEREST_TABLE_UPDATED', 'DELIVERED', 1, null],
    ['BOOKING_CREATED', 'DELIVERED', 1, null],
  ]

  return rows.map(([eventType, status, tries, reason], index) => {
    const minutesAgo = (index + 1) * 37
    return {
      eventType,
      eventLabel: eventLabelFor(eventType),
      tries,
      reason,
      whenRelative: RELATIVE[index % RELATIVE.length],
      occurredAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
      status,
      isTest: false,
      minutesAgo,
      // Historical rows — long since written.
      recordedAt: 0,
    }
  })
}

export let mockWebhookDeliveries: MockDelivery[] = seedDeliveries()

/** Tests mutate both stores, so each file can start from a known state. */
export function resetMockWebhooks(): void {
  mockWebhookState = seedState()
  mockWebhookDeliveries = seedDeliveries()
  testRecordDelayMs = MOCK_TEST_RECORD_DELAY_MS
}

/** Drops the config entirely — the AC-01.1 unconfigured path. */
export function clearMockWebhookConfig(): void {
  mockWebhookState = {
    endpointUrl: null,
    bearerToken: null,
    signingSecret: null,
    signingSecretMasked: null,
    enabled: false,
    secretRotatedAt: null,
  }
}

function isConfigured(): boolean {
  return !!mockWebhookState.endpointUrl && !!mockWebhookState.bearerToken
}

/**
 * The config as the API returns it. `signingSecret` is always null here — the
 * full value exists only in the first-save and rotate responses (BR-04).
 */
export function configResponse(reveal = false): WebhookConfig {
  const configured = isConfigured()
  return {
    endpointUrl: mockWebhookState.endpointUrl,
    bearerTokenMasked: configured ? BEARER_MASK : null,
    // Fails closed — only an explicit reveal populates the plaintext.
    bearerToken: reveal && configured ? mockWebhookState.bearerToken : null,
    signingSecretMasked: mockWebhookState.signingSecretMasked,
    signingSecret: null,
    enabled: mockWebhookState.enabled,
    configured,
    secretRotatedAt: mockWebhookState.secretRotatedAt,
  }
}

export function errorResponse(code: string, message: string, status: number): Response {
  return HttpResponse.json({ success: false, error: { code, message, details: null } }, { status })
}

const HTTPS_MAX = 2048
const TOKEN_MAX = 500

export function saveMockWebhookConfig(body: Record<string, unknown>): Response {
  // Rejected outright rather than ignored — scope comes from the token and the
  // secret is platform-generated.
  if ('signingSecret' in body || 'restaurantId' in body) {
    return errorResponse('ERR_VALIDATION', 'Unexpected field.', 422)
  }

  const endpointUrl = String(body.endpointUrl ?? '').trim()
  const bearerToken = String(body.bearerToken ?? '').trim()

  let parsed: URL | null
  try {
    parsed = new URL(endpointUrl)
  } catch {
    parsed = null
  }
  if (parsed?.protocol !== 'https:' || endpointUrl.length > HTTPS_MAX) {
    return errorResponse('ERR_VALIDATION', 'Endpoint URL must use HTTPS.', 422)
  }
  // MET-1282 — scheme and length said yes to `https://no-tld`, which then fails
  // every delivery as unresolvable. The host has to be routable too.
  if (!isDeliverableWebhookHost(parsed.hostname)) {
    return errorResponse(
      'ERR_VALIDATION',
      'Enter a full hostname, for example https://api.yourdomain.com/hooks.',
      422,
    )
  }
  if (!bearerToken || bearerToken.length > TOKEN_MAX) {
    return errorResponse(
      'ERR_VALIDATION',
      'Bearer token is required — we never post to an unauthenticated endpoint.',
      422,
    )
  }

  const firstSave = !mockWebhookState.signingSecret
  let fullSecret: string | null = null
  if (firstSave) {
    const generated = generateSecret()
    mockWebhookState.signingSecret = generated.full
    mockWebhookState.signingSecretMasked = generated.masked
    fullSecret = generated.full
  }

  mockWebhookState.endpointUrl = endpointUrl
  mockWebhookState.bearerToken = bearerToken
  // Omitted leaves the toggle exactly as it was (BR-07).
  if (typeof body.enabled === 'boolean') mockWebhookState.enabled = body.enabled

  return HttpResponse.json({
    success: true,
    // The generated secret rides along on the first save only (BR-04).
    data: { ...configResponse(), signingSecret: fullSecret },
  })
}

export function rotateMockSecret(): Response {
  if (!isConfigured()) {
    return errorResponse('ERR_NOT_CONFIGURED', 'Save your endpoint and bearer token first.', 409)
  }
  const generated = generateSecret()
  mockWebhookState.signingSecret = generated.full
  mockWebhookState.signingSecretMasked = generated.masked
  mockWebhookState.secretRotatedAt = new Date().toISOString()

  return HttpResponse.json({
    success: true,
    data: {
      signingSecret: generated.full,
      signingSecretMasked: generated.masked,
      secretRotatedAt: mockWebhookState.secretRotatedAt,
    },
  })
}

const EVENT_TYPES: WebhookEventType[] = [
  'INTEREST_TABLE_PUBLISHED',
  'INTEREST_TABLE_UPDATED',
  'INTEREST_TABLE_CANCELLED',
  'BOOKING_CREATED',
  'BOOKING_CONFIRMED',
  'BOOKING_COMPLETED',
  'BOOKING_CANCELLED',
]

export function sendMockTest(body: Record<string, unknown>): Response {
  if (!isConfigured()) {
    return errorResponse('ERR_NOT_CONFIGURED', 'Save your endpoint and bearer token first.', 409)
  }
  const eventType = body.eventType as WebhookEventType
  if (!EVENT_TYPES.includes(eventType)) {
    return errorResponse('ERR_VALIDATION', 'Unknown event type.', 422)
  }

  // Works while the toggle is OFF (AC-05.2). Queued, not delivered — the row
  // lands in the log, which is where the outcome lives. It is not readable
  // straight away: see `recordedAt`.
  mockWebhookDeliveries.unshift({
    eventType,
    eventLabel: eventLabelFor(eventType),
    tries: 1,
    reason: null,
    whenRelative: 'just now',
    occurredAt: new Date().toISOString(),
    status: 'DELIVERED',
    isTest: true,
    minutesAgo: 0,
    recordedAt: Date.now() + testRecordDelayMs,
  })

  return HttpResponse.json({ success: true, data: { queued: true, eventType } }, { status: 202 })
}

const STATUS_FILTERS: DeliveryStatusFilter[] = ['ALL', 'DELIVERED', 'RETRYING', 'FAILED']

function matchesStatus(delivery: MockDelivery, filter: DeliveryStatusFilter): boolean {
  if (filter === 'ALL') return true
  // FAILED covers both terminal states, emailed or not.
  if (filter === 'FAILED') {
    return delivery.status === 'FAILED' || delivery.status === 'FAILED_EMAILED'
  }
  return delivery.status === filter
}

/** Never 400s: a bad page, size or status falls back to the default view. */
export function listMockDeliveries(query: {
  page?: string | null
  pageSize?: string | null
  status?: string | null
}): Response {
  const requested = (query.status ?? 'ALL') as DeliveryStatusFilter
  const status = STATUS_FILTERS.includes(requested) ? requested : 'ALL'

  const parsedSize = Number(query.pageSize)
  const pageSize = Number.isInteger(parsedSize) && parsedSize > 0 ? parsedSize : 25

  const now = Date.now()
  const rows = mockWebhookDeliveries
    // A record F2 has not written yet is not in the log yet (MET-1277).
    .filter((delivery) => delivery.recordedAt <= now)
    .filter((delivery) => matchesStatus(delivery, status))
    // Reverse-chronological (BR-13).
    .sort((a, b) => a.minutesAgo - b.minutesAgo)

  const totalRecords = rows.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const parsedPage = Number(query.page)
  const page =
    Number.isInteger(parsedPage) && parsedPage >= 1 ? Math.min(parsedPage, totalPages) : 1
  const start = (page - 1) * pageSize

  const items: WebhookDelivery[] = rows.slice(start, start + pageSize).map((row) => ({
    eventType: row.eventType,
    eventLabel: row.eventLabel,
    tries: row.tries,
    reason: row.reason,
    whenRelative: row.whenRelative,
    occurredAt: row.occurredAt,
    status: row.status,
    isTest: row.isTest,
  }))

  return HttpResponse.json({
    success: true,
    data: { items, pagination: { page, pageSize, totalRecords, totalPages } },
  })
}
