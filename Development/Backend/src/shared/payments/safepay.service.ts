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
 *   simulator   authorize → capture → void / refund, all answered locally.
 *   live        the payer pays on Safepay's hosted checkout page; Safepay takes
 *               the payment in full there. GoMingle then keeps it (no-show) or
 *               refunds it (guests arrived, cancelled), seat by seat.
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

  private async call(method: string, path: string, body?: unknown): Promise<any> {
    const res = await fetch(`${this.host}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-SFPY-MERCHANT-SECRET': config.safepay.secretKey },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data: any = await res.json().catch(() => ({}))
    // The passport token comes back as a bare string in `data`.
    if (res.ok && typeof data?.data === 'string') return data.data
    if (!res.ok) throw new GatewayError(data?.status?.message ?? data?.message ?? `Safepay ${res.status}`, res.status, data)
    return data?.data ?? data
  }

  /** True when real Safepay keys are set. */
  get isLive(): boolean {
    return this.live
  }

  /**
   * Places a hold for a booking.
   *
   * Simulator: the hold is placed at once. Live: nothing is sent to Safepay
   * yet, because a Safepay payment only exists once somebody pays on Safepay's
   * checkout page (see `startCheckout`); until then the hold waits for a card.
   */
  async authorize(_amount: number, _orderId: string): Promise<{ tracker: string; state: string }> {
    // Test aid: GM_SIMULATE_PENDING_CARD=1 makes the simulator wait for the card step like the live gateway.
    const waits = this.live || process.env.GM_SIMULATE_PENDING_CARD === '1'
    return { tracker: this.live ? 'not-started' : `track_${crypto.randomUUID()}`, state: waits ? 'PENDING_PAYER' : 'AUTHORIZED' }
  }

  /**
   * Opens a payment on Safepay's hosted checkout page. The card is typed on
   * Safepay's page, never into GoMingle. Returns the page to send the payer to.
   */
  async startCheckout(amount: number, orderId: string, returnUrl: string, cancelUrl: string): Promise<{ tracker: string; url: string }> {
    if (!this.live) throw new GatewayError('Safepay keys are not set, so there is no Safepay checkout to open.', 409, null)
    const session = await this.call('POST', '/order/payments/v3/', {
      merchant_api_key: config.safepay.apiKey,
      intent: 'CYBERSOURCE',
      mode: 'payment',
      entry_mode: 'raw',
      currency: 'PKR',
      amount: toMinor(amount),
      metadata: { order_id: orderId },
      include_fees: false,
    })
    const tracker: string | undefined = session?.tracker?.token ?? session?.token
    if (!tracker) throw new GatewayError('Safepay did not return a payment tracker.', 502, session)
    const passport = await this.call('POST', '/client/passport/v1/token', {})
    const tbt: string | undefined = typeof passport === 'string' ? passport : passport?.token
    if (!tbt) throw new GatewayError('Safepay did not return a checkout token.', 502, null)
    const production = config.safepay.environment === 'production'
    const page = production ? 'https://getsafepay.com/embedded/' : 'https://sandbox.api.getsafepay.com/embedded/'
    const query = new URLSearchParams({
      environment: production ? 'production' : 'sandbox',
      tracker,
      tbt,
      source: 'hosted',
      redirect_url: returnUrl,
      cancel_url: cancelUrl,
    })
    return { tracker, url: `${page}?${query.toString()}` }
  }

  /** What Safepay says about a payment, e.g. TRACKER_STARTED, TRACKER_ENDED (paid). */
  async trackerState(tracker: string): Promise<string> {
    if (!this.live) return 'UNKNOWN'
    const data = await this.call('GET', `/reporter/api/v1/payments/${encodeURIComponent(tracker)}`)
    return String(data?.tracker?.state ?? data?.state ?? 'UNKNOWN').toUpperCase()
  }

  /** Whether a checkout payment went through. */
  async isPaid(tracker: string): Promise<boolean> {
    return ['TRACKER_ENDED', 'PAID'].includes(await this.trackerState(tracker))
  }

  /**
   * Collects a hold, in full, into GoMingle's merchant balance (escrow).
   * Safepay has no partial capture; anything that must be collected in part is
   * held as several separate holds instead (see the per-seat penalty holds).
   */
  async capture(tracker: string): Promise<void> {
    // Test aid for the simulator: lets the failure path be exercised without a gateway.
    if (!this.live && process.env.GM_SIMULATE_CAPTURE_FAILURE === '1') {
      throw new GatewayError('Simulated capture failure', 502, null)
    }
    if (this.live) await this.call('POST', `/order/payments/v3/${tracker}`, {})
  }

  /** Releases an uncaptured hold. */
  async void(tracker: string): Promise<void> {
    if (this.live) await this.call('POST', `/order/payments/v3/${tracker}/void`, {})
  }

  /** Returns captured funds to the Mingler. */
  async refund(tracker: string, amount: number): Promise<void> {
    if (this.live) await this.call('POST', `/order/payments/v3/${tracker}/refund`, { currency: 'PKR', amount: toMinor(amount) })
  }
}
