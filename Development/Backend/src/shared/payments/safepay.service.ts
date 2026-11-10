import crypto from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { config } from '../../config'

/** A Safepay API failure; `safepay` is the gateway's own answer. */
export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly safepay: unknown,
  ) {
    super(message)
  }
}

/** Amounts go to Safepay in paisa (minor units); GoMingle keeps rupees. */
const toMinor = (pkr: number) => Math.round(pkr * 100)

/**
 * Safepay gateway adapter (Pakistan; SBP-licensed; PKR).
 *
 * GoMingle uses Safepay's separate authorize / capture flow as the escrow mechanism:
 *   authorize (no capture) → funds reserved on the Mingler's card
 *   capture                → funds collected into GoMingle's Safepay balance, held in escrow
 *   void / refund          → hold released / money returned
 *
 * Two modes:
 *   simulator (default)  no keys, no network: every call succeeds; the escrow
 *                        ledger's own state machine decides what is allowed.
 *   live                 the real Safepay API (sandbox or production host),
 *                        enabled by SAFEPAY_SECRET_KEY and SAFEPAY_API_KEY.
 */
@Injectable()
export class SafepayService {
  private readonly host = config.safepay.environment === 'production' ? 'https://api.getsafepay.com' : 'https://sandbox.api.getsafepay.com'
  private readonly live = Boolean(config.safepay.secretKey && config.safepay.apiKey)

  /** What the Escrow screens show about the gateway. Never includes a key. */
  readonly gateway = {
    name: 'Safepay',
    environment: config.safepay.environment,
    mode: this.live ? 'live' : 'simulator',
    host: this.host,
  }

  private async call(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<any> {
    const res = await fetch(`${this.host}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-SFPY-MERCHANT-SECRET': config.safepay.secretKey,
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data: any = await res.json().catch(() => ({}))
    if (!res.ok) throw new GatewayError(data?.status?.message ?? data?.message ?? `Safepay ${res.status}`, res.status, data)
    return data?.data ?? data
  }

  /**
   * Places a hold for a booking. Live: creates the tracker; the Mingler then
   * completes card entry and 3-D Secure in the app, after which `status()`
   * reports it authorised.
   */
  async authorize(amount: number, orderId: string): Promise<{ tracker: string; state: string }> {
    if (!this.live) return { tracker: `track_${crypto.randomUUID()}`, state: 'AUTHORIZED' }
    const data = await this.call('POST', '/order/payments/v3/', {
      merchant_api_key: config.safepay.apiKey,
      intent: 'CYBERSOURCE',
      mode: 'payment',
      currency: 'PKR',
      amount: toMinor(amount),
      metadata: { order_id: orderId },
    })
    return { tracker: data?.tracker?.token ?? data?.token, state: 'PENDING_PAYER' }
  }

  /** Whether the Mingler's card hold went through (live mode asks Safepay). */
  async isAuthorized(tracker: string): Promise<boolean> {
    if (!this.live) return false
    const data = await this.call('GET', `/reporter/api/v1/payments/${tracker}`)
    return ['AUTHORIZED', 'TRACKER_AUTHORIZED', 'PAID', 'TRACKER_ENDED'].includes(String(data?.state ?? 'UNKNOWN').toUpperCase())
  }

  /**
   * Collects held funds into GoMingle's merchant balance (escrow). With
   * `amount`, only that part of the hold is collected and the rest is let go.
   * TODO(go-live): confirm the partial-capture body and idempotency header
   * against Safepay's current API reference before using live keys.
   */
  async capture(tracker: string, amount?: number, idempotencyKey?: string): Promise<void> {
    if (!this.live) return
    await this.call('POST', `/order/payments/v3/${tracker}`, amount === undefined ? {} : { amount: toMinor(amount) }, idempotencyKey)
  }

  /** Releases an uncaptured hold. */
  async void(tracker: string): Promise<void> {
    if (this.live) await this.call('POST', `/order/payments/v3/${tracker}/void`, {})
  }

  /** Returns captured funds to the Mingler. */
  async refund(tracker: string, amount: number): Promise<void> {
    if (this.live) await this.call('POST', `/order/payments/v3/${tracker}/refund`, { amount: toMinor(amount) })
  }
}
