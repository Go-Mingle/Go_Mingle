/** The seven webhook event types delivered across the two ordered streams (BR-09). */
export type WebhookEventType =
  | 'INTEREST_TABLE_PUBLISHED'
  | 'INTEREST_TABLE_UPDATED'
  /**
   * The partner-facing name. F2's engine table calls this stream's third event
   * `DELETED` and translates internally — the catalogue, the test dropdown and
   * the delivery log all use CANCELLED (spec Deltas).
   */
  | 'INTEREST_TABLE_CANCELLED'
  | 'BOOKING_CREATED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_COMPLETED'
  | 'BOOKING_CANCELLED'

/**
 * The single endpoint configuration for the restaurant (BR-01).
 *
 * Secrets are masked by default. `bearerToken` is populated only when the client
 * asks to reveal it; `signingSecret` is **always null here** — the full value
 * exists in exactly two responses ever, the first save and a rotation (BR-04),
 * and cannot be re-read afterwards (AC-02.3).
 */
export interface WebhookConfig {
  endpointUrl: string | null
  bearerTokenMasked: string | null
  /** Plaintext, and only when explicitly revealed (BR-16). Null otherwise. */
  bearerToken: string | null
  /** e.g. `whsec_••••3a9f` — the last four let a partner confirm which secret is live. */
  signingSecretMasked: string | null
  /** Always null on a read. See the note above. */
  signingSecret: string | null
  enabled: boolean
  /** False until a valid endpoint + bearer token are saved; locks the toggle (BR-06). */
  configured: boolean
  secretRotatedAt: string | null
}

/**
 * The save payload (BR-07 — URL, token and toggle persist atomically).
 *
 * `enabled` is deliberately optional: omitting it leaves the toggle as-is, and
 * sending `false` mutes a live integration. An ordinary URL or token edit must
 * therefore omit it rather than pass the current value along.
 *
 * `signingSecret` and `restaurantId` are rejected with a 422, not ignored, so
 * neither is modelled here.
 */
export interface SaveWebhookConfigDto {
  endpointUrl: string
  bearerToken: string
  enabled?: boolean
}

/** The first save returns the generated secret in full, once (BR-04). */
export interface SaveWebhookConfigResponse extends WebhookConfig {
  signingSecret: string | null
}

/** Rotation returns the new secret in full, once; the old one dies immediately (BR-05). */
export interface RotateSecretResponse {
  signingSecret: string
  signingSecretMasked: string
  secretRotatedAt: string
}

/**
 * A 202 — accepted for delivery, nothing more. The POST happens out of band and
 * the outcome only exists in Recent Deliveries, so the copy must not claim the
 * test succeeded.
 */
export interface TestWebhookResponse {
  queued: boolean
  eventType: WebhookEventType
}

/**
 * Four values, not three. `FAILED_EMAILED` is terminal with the payload emailed
 * to the restaurant (BR-11); `FAILED` is terminal *and* the email fallback also
 * failed — so it must not be rendered as "emailed", because the partner never
 * got one.
 */
export type DeliveryStatus = 'DELIVERED' | 'RETRYING' | 'FAILED_EMAILED' | 'FAILED'

/** The status filter on the log (AC-06.2). `FAILED` covers both terminal states. */
export type DeliveryStatusFilter = 'ALL' | 'DELIVERED' | 'RETRYING' | 'FAILED'

/**
 * One row in the Recent Deliveries log (BR-13) — summary only, non-interactive,
 * with no payload or response drill-down (AC-06.3). Note there is no `id`.
 */
export interface WebhookDelivery {
  eventType: WebhookEventType
  /** Ready to display, e.g. "Interest table · Published". */
  eventLabel: string
  tries: number
  /** Failure reason, or null when delivered. */
  reason: string | null
  /** Pre-rendered by the backend, e.g. "3h ago". */
  whenRelative: string
  /** Absolute timestamp, for a tooltip or custom formatting. */
  occurredAt: string
  status: DeliveryStatus
  /** True for deliveries triggered by "Send test" (BR-12). */
  isTest: boolean
}

/**
 * MET-1277 — a row as the *table* renders it, which is not quite a row as the
 * API returns it.
 *
 * `POST /test` answers 202 and nothing else: the delivery record is written by
 * the F2 worker out of band, so between the 202 and the worker's write there is
 * a real interval in which the partner has been told "queued" and the log has
 * nothing in it. `QUEUED` is the client's own marker for that interval — the API
 * never returns it — so it lives here rather than widening `DeliveryStatus`.
 */
export type DeliveryRowStatus = DeliveryStatus | 'QUEUED'

export interface WebhookDeliveryRow extends Omit<WebhookDelivery, 'status'> {
  status: DeliveryRowStatus
  /** True only for the locally-held queued marker — never for a server row. */
  pending?: boolean
}

export interface WebhookDeliveriesPagination {
  page: number
  pageSize: number
  totalRecords: number
  totalPages: number
}

export interface WebhookDeliveriesPage {
  items: WebhookDelivery[]
  pagination: WebhookDeliveriesPagination
}

/**
 * Grid params. A bad page, size or status never 400s — the backend falls back to
 * the default view — so no defensive clamping is needed here.
 */
export interface WebhookDeliveriesQueryParams {
  page?: number
  pageSize?: number
  status?: DeliveryStatusFilter
}
