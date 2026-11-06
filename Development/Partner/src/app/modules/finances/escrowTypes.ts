/** Safepay escrow, as the restaurant sees it (GET /api/v1/partner/escrow). */
export type PartnerEscrowStatus =
  | 'PENDING_PAYMENT'
  | 'AUTHORIZED'
  | 'IN_ESCROW'
  | 'RELEASED'
  | 'REFUNDED'
  | 'VOIDED'

export interface PartnerEscrowItem {
  id: string
  bookingRef: string
  minglerName: string
  guests: number
  amount: number
  restaurantNet: number
  platformFee: number
  eventName: string
  status: PartnerEscrowStatus
  updatedAt: string
  payout?: { reference: string; amount: number; bank: string; ibanMasked: string; paidAt: string }
}

export interface PartnerEscrowOverview {
  gateway: { name: string; environment: 'sandbox' | 'production'; mode: 'simulator' | 'live' }
  summary: {
    authorized: number
    inEscrow: number
    released: number
    refunded: number
    platformFeePct: number
    count: number
  }
  payoutAccount: { accountTitle: string; bankName: string; iban: string } | null
  items: PartnerEscrowItem[]
}
