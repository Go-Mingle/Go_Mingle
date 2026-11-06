/**
 * J4 Webhook Integration (Partner Portal).
 *
 * The path is singular — BR-01 makes the config a per-restaurant singleton, so
 * there is no collection and no id in any route. Restaurant scope comes from the
 * access token (F1 BR-04); `restaurantId` in a body is rejected with a 422.
 */
export const WEBHOOK_ENDPOINTS = {
  config: '/api/v1/partner/webhook',
  rotateSecret: '/api/v1/partner/webhook/rotate-secret',
  test: '/api/v1/partner/webhook/test',
  deliveries: '/api/v1/partner/webhook/deliveries',
} as const

export const WEBHOOK_CONFIG_QUERY_KEY = ['partner', 'webhook', 'config'] as const
export const WEBHOOK_DELIVERIES_QUERY_KEY = ['partner', 'webhook', 'deliveries'] as const

/**
 * BR-13 — the log is a 30-day rolling window, paginated.
 *
 * MET-1274 — 25, the documented default for J4 §Endpoint 5, which inherits the
 * platform pagination contract (F1 Partner BR-13: default 25, max 100, 1-based).
 * The client used to ask for 8, which tripled the number of pages the partner had
 * to walk for no reason any spec knows about.
 */
export const DELIVERIES_PAGE_SIZE = 25

/**
 * MET-1277 — how long the client waits for a test send to surface in the log.
 *
 * A 202 from `POST /test` says accepted, not recorded; the record is F2's to
 * write. A single invalidation fired the instant the 202 lands almost always
 * refetches *before* the worker has written anything, which is why the row
 * appeared to never arrive at all. So the log is polled for a bounded window
 * instead, and the partner is shown a queued marker meanwhile.
 */
export const TEST_DELIVERY_POLL_INTERVAL_MS = 5_000

/**
 * When to stop waiting. QA saw nothing after 150s of polling, so a window that
 * expires quietly would just reproduce the bug more slowly — at the end of it
 * the queued row says so rather than disappearing.
 */
export const TEST_DELIVERY_CONFIRM_WINDOW_MS = 120_000

/**
 * Slack on `occurredAt` when matching the server's record to the test we sent.
 * The timestamp is the server's and `sentAt` is the browser's, so an exact
 * `>=` would miss the row on any clock that runs a few seconds behind.
 */
export const TEST_DELIVERY_CLOCK_SKEW_MS = 30_000

/** BR-02 / BR-03 entity limits, checked client-side so a 422 is the exception. */
export const ENDPOINT_URL_MAX_LENGTH = 2048
export const BEARER_TOKEN_MAX_LENGTH = 500

/**
 * J4-introduced (spec §4.3). Raised by rotate and test when no endpoint has been
 * saved yet — a precondition, not a session failure, so it must never clear the
 * session the way a 403 suspension does.
 */
export const WEBHOOK_ERROR_CODES = {
  NOT_CONFIGURED: 'ERR_NOT_CONFIGURED',
} as const
