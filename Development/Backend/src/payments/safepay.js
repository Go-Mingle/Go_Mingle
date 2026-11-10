import crypto from 'node:crypto'

/**
 * Safepay gateway adapter (Pakistan; SBP-licensed; PKR).
 *
 * GoMingle uses Safepay's separate authorize / capture flow as the escrow
 * mechanism:
 *   authorize (do_capture: false) → funds reserved on the Mingler's card
 *   capture                        → funds collected into GoMingle's Safepay
 *                                    merchant balance and held in escrow
 *   void / refund                  → hold released / money returned
 * Releasing escrow to a restaurant is a payout from GoMingle's balance to the
 * restaurant's bank account (see escrow.js).
 *
 * Two modes:
 *   simulator (default)   in-process Safepay sandbox with the same state
 *                         machine — no keys or network needed for demos.
 *   sandbox / production  real Safepay API, enabled by SAFEPAY_SECRET_KEY and
 *                         SAFEPAY_API_KEY (SAFEPAY_ENV picks the host). Paths
 *                         follow Safepay's v3 order API (@sfpy/node-core).
 */

const env = process.env.SAFEPAY_ENV === 'production' ? 'production' : 'sandbox'
const HOST = env === 'production' ? 'https://api.getsafepay.com' : 'https://sandbox.api.getsafepay.com'
const SECRET = process.env.SAFEPAY_SECRET_KEY ?? ''
const API_KEY = process.env.SAFEPAY_API_KEY ?? ''

export const gateway = {
  name: 'Safepay',
  environment: env,
  mode: SECRET && API_KEY ? 'live' : 'simulator',
  host: HOST,
}

/** Amounts go to Safepay in paisa (minor units); GoMingle keeps rupees. */
const toMinor = (pkr) => Math.round(pkr * 100)

async function safepay(method, path, body) {
  const res = await fetch(`${HOST}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-SFPY-MERCHANT-SECRET': SECRET },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = data?.status?.message ?? data?.message ?? `Safepay ${res.status}`
    throw Object.assign(new Error(message), { status: res.status, safepay: data })
  }
  return data?.data ?? data
}

// ── Simulator ───────────────────────────────────────────────────────────────

const simulated = new Map() // tracker -> { state, amount }

function simTracker(amount) {
  const tracker = `track_${crypto.randomUUID()}`
  simulated.set(tracker, { state: 'AUTHORIZED', amount })
  return tracker
}

function simTransition(tracker, from, to) {
  const t = simulated.get(tracker) ?? { state: from }
  if (t.state !== from) throw Object.assign(new Error(`Tracker is ${t.state}, expected ${from}`), { status: 409 })
  t.state = to
  simulated.set(tracker, t)
}

// ── Gateway operations ──────────────────────────────────────────────────────

/**
 * Places a hold (pre-authorisation) for a booking. In live mode this creates
 * the tracker; the Mingler completes card entry + 3-D Secure in the app, after
 * which `status()` reports it authorised.
 */
export async function authorize({ amount, orderId }) {
  if (gateway.mode === 'simulator') {
    return { tracker: simTracker(amount), state: 'AUTHORIZED', checkoutUrl: null }
  }
  const data = await safepay('POST', '/order/payments/v3/', {
    merchant_api_key: API_KEY,
    intent: 'CYBERSOURCE',
    mode: 'payment',
    currency: 'PKR',
    amount: toMinor(amount),
    metadata: { order_id: orderId },
  })
  const tracker = data?.tracker?.token ?? data?.token
  return { tracker, state: 'PENDING_PAYER', checkoutUrl: null }
}

/** Current gateway state of a tracker (live mode reads Safepay's reporter API). */
export async function status(tracker) {
  if (gateway.mode === 'simulator') return simulated.get(tracker)?.state ?? 'UNKNOWN'
  const data = await safepay('GET', `/reporter/api/v1/payments/${tracker}`)
  return data?.state ?? 'UNKNOWN'
}

/** Collects held funds into GoMingle's merchant balance (escrow). */
export async function capture(tracker) {
  if (gateway.mode === 'simulator') return simTransition(tracker, 'AUTHORIZED', 'CAPTURED')
  await safepay('POST', `/order/payments/v3/${tracker}`, {})
}

/** Releases an uncaptured hold (cancellation before the 24-hour mark). */
export async function voidHold(tracker) {
  if (gateway.mode === 'simulator') return simTransition(tracker, 'AUTHORIZED', 'VOIDED')
  await safepay('POST', `/order/payments/v3/${tracker}/void`, {})
}

/** Returns captured funds to the Mingler. */
export async function refund(tracker, amount) {
  if (gateway.mode === 'simulator') return simTransition(tracker, 'CAPTURED', 'REFUNDED')
  await safepay('POST', `/order/payments/v3/${tracker}/refund`, { amount: toMinor(amount) })
}

/** Restores simulator state after a restart. */
export function restoreSimulated(holds) {
  if (gateway.mode !== 'simulator') return
  const map = { AUTHORIZED: 'AUTHORIZED', IN_ESCROW: 'CAPTURED', RELEASED: 'CAPTURED', REFUNDED: 'REFUNDED', VOIDED: 'VOIDED' }
  for (const h of holds) simulated.set(h.tracker, { state: map[h.status] ?? 'AUTHORIZED', amount: h.amount })
}
