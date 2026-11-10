import { http, HttpResponse } from 'msw'
import type {
  EscrowAction,
  EscrowItem,
  EscrowOverview,
  EscrowStatus,
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

export function resetMockEscrow() {
  ledger = seed()
}

function overview(status: EscrowStatus | null): EscrowOverview {
  const all = [...ledger.values()]
  const sum = (s: EscrowStatus, pick: (i: EscrowItem) => number = (i) => i.amount) =>
    round(all.filter((i) => i.status === s).reduce((t, i) => t + pick(i), 0))
  return {
    gateway: { name: 'Safepay', environment: 'sandbox', mode: 'simulator' },
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

  // A sandbox booking at an interest table: the hold is the no-show penalty × seats.
  http.post('*/api/v1/admin/bookings/sandbox', async ({ request }) => {
    const body = (await request.json()) as { interestTableId?: string; minglerName?: string; seats?: number }
    if (!body.interestTableId) return error(422, 'ERR_VALIDATION', 'Choose an interest table.')
    const seats = body.seats ?? 2
    const id = `esc-${String(ledger.size + 101).padStart(6, '0')}`
    const hold = makeItem(
      id,
      RESTAURANTS[0].id,
      body.minglerName || 'Test Mingler',
      seats,
      MOCK_NO_SHOW_PENALTY_PKR,
      'Friday Wine Evening',
      'AUTHORIZED',
    )
    ledger.set(id, hold)
    return HttpResponse.json(
      {
        success: true,
        data: {
          booking: { id: `bk-${id}`, bookingRef: hold.bookingRef, seats, penaltyPerSeatPkr: MOCK_NO_SHOW_PENALTY_PKR },
          hold,
        },
      },
      { status: 201 },
    )
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
