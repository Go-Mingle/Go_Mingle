/** Escrow transaction state — mirrors the Safepay authorize/capture lifecycle. */
export type EscrowStatus =
  | 'PENDING_PAYMENT'
  | 'AUTHORIZED'
  | 'IN_ESCROW'
  | 'RELEASED'
  | 'REFUNDED'
  | 'VOIDED'

export type EscrowAction = 'capture' | 'void' | 'release' | 'refund'

export interface EscrowTimelineEntry {
  status: EscrowStatus
  at: string
  by: string
  note?: string
}

export interface EscrowPayout {
  reference: string
  amount: number
  platformFee: number
  accountTitle: string
  bank: string
  ibanMasked: string
  paidAt: string
}

export interface EscrowItem {
  id: string
  bookingRef: string
  restaurantId: string
  restaurantName: string
  minglerName: string
  guests: number
  amount: number
  currency: 'PKR'
  platformFeePct: number
  platformFee: number
  restaurantNet: number
  eventName: string
  eventAt: string
  gateway: string
  tracker: string
  status: EscrowStatus
  createdAt: string
  updatedAt: string
  timeline: EscrowTimelineEntry[]
  payout?: EscrowPayout
  payoutTo: string | null
}

export interface EscrowSummary {
  currency: 'PKR'
  authorized: number
  inEscrow: number
  released: number
  refunded: number
  platformFees: number
  platformFeePct: number
  count: number
}

export interface EscrowGateway {
  name: string
  environment: 'sandbox' | 'production'
  mode: 'simulator' | 'live'
}

export interface EscrowRestaurantOption {
  id: string
  name: string
  hasPayoutAccount: boolean
}

export interface EscrowOverview {
  gateway: EscrowGateway
  summary: EscrowSummary
  items: EscrowItem[]
  restaurants: EscrowRestaurantOption[]
}

export interface TestBookingRequest {
  restaurantId: string
  minglerName: string
  guests: number
  amountPerGuest: number
  eventName?: string
  /**
   * Books seats at this interest table instead of placing a plain payment hold.
   * The hold is then the restaurant's no-show penalty × seats (none when it is zero).
   */
  interestTableId?: string
}

export interface InterestTableOption {
  interestTableId: string
  interestTableName: string
}

/** What a sandbox booking at an interest table returns. */
export interface TableBookingResult {
  booking: { id: string; bookingRef: string; seats: number; penaltyPerSeatPkr: number }
  /** Null when the restaurant's no-show penalty is zero: nothing is held. */
  hold: EscrowItem | null
}
