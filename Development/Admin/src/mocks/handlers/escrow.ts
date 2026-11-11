import { http, HttpResponse } from 'msw'
import type {
  EscrowAction,
  EscrowItem,
  EscrowOverview,
  EscrowStatus,
  PaymentFailure,
  TestBookingRequest,
} from '../../app/modules/escrow/types'

/**
 * Mock Safepay escrow ledger for the admin portal (tests and mock-only demos).
 * The real ledger lives in the GoMingle API (src/payments/escrow.js).
 */

const BASE = '/api/v1/escrow'
const FEE_PCT = 10

const RESTAURANTS = [
  { id: 'rest1', name: 'Aurelia Dining', hasPayoutAccount: true },
  { id: 'rest2', name: 'Saffron Terrace', hasPayoutAccount: false },
  { id: 'rest3', name: 'Clifton Grill House', hasPayoutAccount: true },
]

const round = (n: number) => Math.round(n * 100) / 100

function makeItem(
  id: string,
  restaurantId: string,
  minglerName: string,
  guests: number,
  perGuest: number,
  eventName: string,
  status: EscrowStatus,
): EscrowItem {
  const amount = guests * perGuest
  const fee = round((amount * FEE_PCT) / 100)
  const restaurant = RESTAURANTS.find((r) => r.id === restaurantId)
  const at = '2026-11-01T12:00:00.000Z'
  return {
    id,
    bookingRef: `GM-${id.slice(-6).toUpperCase()}`,
    restaurantId,
    restaurantName: restaurant?.name ?? restaurantId,
    minglerName,
    guests,
    amount,
    currency: 'PKR',
    platformFeePct: FEE_PCT,
    platformFee: fee,
    restaurantNet: round(amount - fee),
    eventName,
    eventAt: at,
    gateway: 'Safepay',
    tracker: `track_${id}`,
    status,
    createdAt: at,
    updatedAt: at,
    timeline: [{ status, at, by: 'System' }],
    payoutTo: restaurant?.hasPayoutAccount ? 'PK40 •••• 6702' : null,
    ...(status === 'RELEASED' && {
      payout: {
        reference: 'PO-1A2B3C',
        amount: round(amount - fee),
        platformFee: fee,
        accountTitle: 'Aurelia Dining (Pvt) Ltd',
        bank: 'Meezan Bank',
        ibanMasked: 'PK40 •••• 6702',
        paidAt: at,
      },
    }),
  }
}

function seed(): Map<string, EscrowItem> {
  return new Map(
    [
      makeItem('esc-000101', 'rest1', 'Sana Khan', 4, 3200, 'Founders & Filter Coffee', 'RELEASED'),
      makeItem('esc-000102', 'rest1', 'Osama Khalil', 2, 2800, 'Sufi Night Supper Club', 'IN_ESCROW'),
      makeItem('esc-000103', 'rest1', 'Hira Mansoor', 3, 3500, 'Startup Founders Brunch', 'AUTHORIZED'),
      makeItem('esc-000104', 'rest2', 'Laiba Hassan', 5, 2600, 'Book Club Biryani', 'IN_ESCROW'),
      makeItem('esc-000105', 'rest3', 'Parveen Rizvi', 2, 4100, 'Tasting Table', 'REFUNDED'),
      makeItem('esc-000106', 'rest2', 'Danish Ahmed', 4, 2900, 'Gaming Night', 'VOIDED'),
    ].map((i) => [i.id, i]),
  )
}

let ledger = seed()

/** Restores the seeded ledger (called between tests). */
/** The no-show penalty per seat the mock restaurant charges. */
export const MOCK_NO_SHOW_PENALTY_PKR = 1500

let failures: PaymentFailure[] = []
let gatewayMode: 'simulator' | 'live' = 'simulator'
/** What the mock Safepay says about checkouts that were opened. */
let checkoutState = 'TRACKER_STARTED'

/** Test helper: behaves as if Safepay keys were set, so Safepay's checkout is offered. */
export function setMockGatewayLive(state = 'TRACKER_STARTED') {
  gatewayMode = 'live'
  checkoutState = state
}

/** Test helper: a dinner bill charged at check-in. */
export function addMockBill(seats = 4) {
  const id = 'esc-000950'
  ledger.set(id, { ...makeItem(id, 'rest1', 'Ayesha Noor', seats, 3200, 'Seafront Supper', 'IN_ESCROW'), bookingRef: 'GM-BILL01', kind: 'BILL', bookingId: 'bk-bill', gateway: 'Simulated' })
}

/** Test helper: puts failed collections on the escrow screen. */
export function setMockPaymentFailures(next: Partial<PaymentFailure>[]) {
  failures = next.map((f, index) => ({
    id: index + 1,
    action: 'capture',
    amount: 1500,
    message: 'Safepay 503',
    at: '2026-11-10T19:30:00.000Z',
    attempts: 1,
    holdId: `esc-f${String(index + 1)}`,
    bookingId: `bk-f${String(index + 1)}`,
    bookingRef: `GM-9000${String(index + 1)}`,
    seatNo: index + 1,
    minglerName: 'Farid Ahmed',
    restaurantName: 'Aurelia Dining',
    eventName: 'Supper Club',
    ...f,
  }))
}

/**
 * Test helper (GM-255): a booking whose holds are still waiting for a card,
 * as happens when Safepay keys are set and no Mingler app has taken the card.
 */
export function addMockPendingBooking(seats = 2) {
  const bookingId = 'bk-pending'
  for (let seat = 1; seat <= seats; seat += 1) {
    const id = `esc-00090${String(seat)}`
    ledger.set(id, {
      ...makeItem(id, 'rest1', 'Farid Ahmed', 1, MOCK_NO_SHOW_PENALTY_PKR, 'Supper Club', 'PENDING_PAYMENT'),
      bookingRef: 'GM-PEND01',
      kind: 'NO_SHOW_HOLD',
      bookingId,
      seatNo: seat,
    })
  }
}

const TEST_CARD_BRANDS: Record<string, string> = {
  '4111111111111111': 'Visa',
  '5555555555554444': 'Mastercard',
}

export function resetMockEscrow() {
  ledger = seed()
  failures = []
  gatewayMode = 'simulator'
  checkoutState = 'TRACKER_STARTED'
}

function overview(status: EscrowStatus | null): EscrowOverview {
  const all = [...ledger.values()]
  const sum = (s: EscrowStatus, pick: (i: EscrowItem) => number = (i) => i.amount) =>
    round(all.filter((i) => i.status === s).reduce((t, i) => t + pick(i), 0))
  return {
    gateway: { name: 'Safepay', environment: 'sandbox', mode: gatewayMode },
    summary: {
      currency: 'PKR',
      authorized: sum('AUTHORIZED'),
      inEscrow: sum('IN_ESCROW'),
      released: sum('RELEASED', (i) => i.restaurantNet),
      refunded: sum('REFUNDED'),
      platformFees: sum('RELEASED', (i) => i.platformFee),
      platformFeePct: FEE_PCT,
      count: all.length,
    },
    items: status ? all.filter((i) => i.status === status) : all,
    paymentFailures: failures,
    restaurants: RESTAURANTS,
  }
}

const TRANSITIONS: Record<EscrowAction, { from: EscrowStatus; to: EscrowStatus }> = {
  capture: { from: 'AUTHORIZED', to: 'IN_ESCROW' },
  void: { from: 'AUTHORIZED', to: 'VOIDED' },
  release: { from: 'IN_ESCROW', to: 'RELEASED' },
  refund: { from: 'IN_ESCROW', to: 'REFUNDED' },
}

const error = (status: number, code: string, message: string) =>
  HttpResponse.json({ success: false, error: { code, message } }, { status })

export const escrowHandlers = [
  // The card step on Safepay's own checkout page: one payment for every waiting seat of the booking.
  http.post(`${BASE}/:id/checkout`, async ({ params, request }) => {
    if (gatewayMode !== 'live') return error(409, 'ERR_GATEWAY_NOT_CONFIGURED', 'Safepay keys are not set, so there is no Safepay checkout. Add a test card instead.')
    const first = ledger.get(String(params.id))
    if (!first) return error(404, 'ERR_NOT_FOUND', 'Escrow transaction not found.')
    const body = (await request.json()) as { returnUrl?: string }
    if (!body.returnUrl) return error(422, 'ERR_VALIDATION', 'A return address is required.')
    const waiting = [...ledger.values()].filter(
      (i) => i.status === 'PENDING_PAYMENT' && (first.bookingId ? i.bookingId === first.bookingId : i.id === first.id),
    )
    const totalPkr = waiting.reduce((t, i) => t + i.amount, 0)
    for (const i of waiting) {
      ledger.set(i.id, { ...i, tracker: 'track_mock', checkout: { totalPkr, startedAt: '2026-11-11T10:00:00.000Z', paidAt: null } })
    }
    return HttpResponse.json({
      success: true,
      data: { url: `https://sandbox.api.getsafepay.com/embedded/?tracker=track_mock&redirect_url=${encodeURIComponent(body.returnUrl)}`, tracker: 'track_mock', totalPkr, seats: waiting.length, bookingRef: first.bookingRef },
    })
  }),

  http.post(`${BASE}/:id/checkout/confirm`, ({ params }) => {
    const first = ledger.get(String(params.id))
    if (!first) return error(404, 'ERR_NOT_FOUND', 'Escrow transaction not found.')
    if (first.status !== 'PENDING_PAYMENT') return HttpResponse.json({ success: true, data: { paid: true, state: 'ALREADY_CONFIRMED', items: [first] } })
    if (!first.checkout) return error(409, 'ERR_INVALID_STATE', 'No Safepay checkout has been opened for this hold yet.')
    if (checkoutState !== 'TRACKER_ENDED') return HttpResponse.json({ success: true, data: { paid: false, state: checkoutState, items: [] } })
    const items = [...ledger.values()]
      .filter((i) => i.status === 'PENDING_PAYMENT' && i.tracker === first.tracker)
      .map((i) => {
        const next: EscrowItem = { ...i, status: 'AUTHORIZED', checkout: { ...i.checkout!, paidAt: '2026-11-11T10:05:00.000Z' } }
        ledger.set(i.id, next)
        return next
      })
    return HttpResponse.json({ success: true, data: { paid: true, state: 'TRACKER_ENDED', items } })
  }),

  // TEMPORARY (GM-255): an admin completes the card step with a test card.
  http.post(`${BASE}/:id/test-card`, async ({ params, request }) => {
    const body = (await request.json()) as { cardNumber?: string }
    const first = ledger.get(String(params.id))
    if (!first) return error(404, 'ERR_NOT_FOUND', 'Escrow hold not found.')
    const number = String(body.cardNumber ?? '')
    if (number === '4000000000000002') return error(402, 'ERR_CARD_DECLINED', 'The card was declined.')
    const brand = TEST_CARD_BRANDS[number]
    if (!brand) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_VALIDATION',
            message: 'Check the card details.',
            details: { fields: { cardNumber: 'Only test card numbers are accepted here.' } },
          },
        },
        { status: 422 },
      )
    }
    const waiting = [...ledger.values()].filter(
      (i) => i.status === 'PENDING_PAYMENT' && (first.bookingId ? i.bookingId === first.bookingId : i.id === first.id),
    )
    if (waiting.length === 0) return error(409, 'ERR_INVALID_STATE', 'This hold is not waiting for a card.')
    const items = waiting.map((i) => {
      const next: EscrowItem = { ...i, status: 'AUTHORIZED', testCard: { brand, last4: number.slice(-4) } }
      ledger.set(i.id, next)
      return next
    })
    return HttpResponse.json({ success: true, data: { items } })
  }),

  http.get(BASE, ({ request }) => {
    const status = new URL(request.url).searchParams.get('status') as EscrowStatus | null
    return HttpResponse.json({ success: true, data: overview(status) })
  }),

  http.post(`${BASE}/test-booking`, async ({ request }) => {
    const body = (await request.json()) as TestBookingRequest
    if (!RESTAURANTS.some((r) => r.id === body.restaurantId)) {
      return error(422, 'ERR_VALIDATION', 'Choose an active restaurant.')
    }
    const id = `esc-${String(ledger.size + 101).padStart(6, '0')}`
    const item = makeItem(
      id,
      body.restaurantId,
      body.minglerName || 'Sandbox Mingler',
      body.guests,
      body.amountPerGuest,
      body.eventName ?? 'Interest Table',
      'AUTHORIZED',
    )
    ledger.set(id, item)
    return HttpResponse.json({ success: true, data: item }, { status: 201 })
  }),

  // A sandbox booking at an interest table: one hold per seat, each for the no-show penalty.
  http.post('*/api/v1/admin/bookings/sandbox', async ({ request }) => {
    const body = (await request.json()) as { interestTableId?: string; minglerName?: string; seats?: number; seatPricePkr?: number }
    if (!body.interestTableId) return error(422, 'ERR_VALIDATION', 'Choose an interest table.')
    const seats = body.seats ?? 2
    const bookingId = `bk-${String(ledger.size + 101)}`
    const holds = Array.from({ length: seats }, (_unused, index) => {
      const id = `esc-${String(ledger.size + 101).padStart(6, '0')}`
      const hold: EscrowItem = {
        ...makeItem(id, RESTAURANTS[0].id, body.minglerName || 'Test Mingler', 1, MOCK_NO_SHOW_PENALTY_PKR, 'Friday Wine Evening', 'AUTHORIZED'),
        kind: 'NO_SHOW_HOLD',
        bookingId,
        seatNo: index + 1,
      }
      ledger.set(id, hold)
      return hold
    })
    return HttpResponse.json(
      {
        success: true,
        data: {
          booking: { id: bookingId, bookingRef: holds[0].bookingRef, seats, penaltyPerSeatPkr: MOCK_NO_SHOW_PENALTY_PKR, seatPricePkr: body.seatPricePkr ?? 0 },
          holds,
          heldTotalPkr: seats * MOCK_NO_SHOW_PENALTY_PKR,
        },
      },
      { status: 201 },
    )
  }),

  http.post(`${BASE}/failures/:id/retry`, ({ params }) => {
    const id = Number(params.id)
    const failure = failures.find((f) => f.id === id)
    if (!failure) return error(404, 'ERR_NOT_FOUND', 'This failure was not found or is already resolved.')
    if (failure.message.includes('still down')) {
      failure.attempts += 1
      return error(502, 'ERR_GATEWAY', `Still failing: ${failure.message}`)
    }
    failures = failures.filter((f) => f.id !== id)
    return HttpResponse.json({ success: true, data: { id, resolved: true } })
  }),

  http.post(`${BASE}/failures/:id/resolve`, async ({ params, request }) => {
    const id = Number(params.id)
    const body = (await request.json()) as { note?: string }
    if (!failures.some((f) => f.id === id)) return error(404, 'ERR_NOT_FOUND', 'This failure was not found or is already resolved.')
    if ((body.note ?? '').trim().length < 5) return error(422, 'ERR_VALIDATION', 'Add a short note on how this was settled.')
    failures = failures.filter((f) => f.id !== id)
    return HttpResponse.json({ success: true, data: { id, resolved: true } })
  }),

  http.post(`${BASE}/:id/:action`, async ({ params, request }) => {
    const item = ledger.get(String(params.id))
    const action = String(params.action) as EscrowAction
    const rule = TRANSITIONS[action]
    if (!item || !rule) return error(404, 'ERR_NOT_FOUND', 'Escrow transaction not found.')
    if (item.status !== rule.from) {
      return error(409, 'ERR_INVALID_STATE', `Cannot ${action} a transaction that is ${item.status}.`)
    }
    const body = (await request.json().catch(() => ({}))) as { reason?: string }
    if (action === 'refund' && !body.reason) {
      return error(422, 'ERR_VALIDATION', 'A reason is required to refund.')
    }
    const restaurant = RESTAURANTS.find((r) => r.id === item.restaurantId)
    if (action === 'release' && !restaurant?.hasPayoutAccount) {
      return error(409, 'ERR_NO_PAYOUT_ACCOUNT', 'This restaurant has not added a payout bank account yet.')
    }
    const at = new Date().toISOString()
    const next: EscrowItem = {
      ...item,
      status: rule.to,
      updatedAt: at,
      timeline: [...item.timeline, { status: rule.to, at, by: 'Admin', ...(body.reason && { note: body.reason }) }],
      ...(action === 'release' && {
        payout: {
          reference: `PO-${item.id.slice(-6).toUpperCase()}`,
          amount: item.restaurantNet,
          platformFee: item.platformFee,
          accountTitle: restaurant?.name ?? '',
          bank: 'Meezan Bank',
          ibanMasked: item.payoutTo ?? '',
          paidAt: at,
        },
      }),
    }
    ledger.set(item.id, next)
    return HttpResponse.json({ success: true, data: next })
  }),
]
