import { http, HttpResponse } from 'msw'
import { FINANCES_ENDPOINTS } from '../../app/modules/finances/constants'
import type { PartnerEscrowOverview } from '../../app/modules/finances/escrowTypes'

/** Mock of the restaurant's Safepay escrow position (tests and mock-only demos). */
export const mockPartnerEscrow: PartnerEscrowOverview = {
  gateway: { name: 'Safepay', environment: 'sandbox', mode: 'simulator' },
  summary: { authorized: 10500, inEscrow: 5600, released: 11520, refunded: 0, platformFeePct: 10, count: 3 },
  payoutAccount: { accountTitle: 'Aurelia Dining (Pvt) Ltd', bankName: 'Meezan Bank', iban: 'PK40 •••• 6702' },
  items: [
    {
      id: 'esc-1',
      bookingRef: 'GM-410233',
      minglerName: 'Sana Khan',
      guests: 4,
      amount: 12800,
      restaurantNet: 11520,
      platformFee: 1280,
      eventName: 'Founders & Filter Coffee',
      status: 'RELEASED',
      updatedAt: '2026-11-01T12:00:00.000Z',
      payout: {
        reference: 'PO-9F2C1A',
        amount: 11520,
        bank: 'Meezan Bank',
        ibanMasked: 'PK40 •••• 6702',
        paidAt: '2026-11-01T12:00:00.000Z',
      },
    },
  ],
}

export const partnerEscrowHandlers = [
  http.get(FINANCES_ENDPOINTS.escrow, () =>
    HttpResponse.json({ success: true, data: mockPartnerEscrow }),
  ),
]
