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
  /**
   * Set on no-show penalty holds. A booking places one hold per seat (Safepay
   * cannot collect part of a hold): a no-show collects the empty seats' holds
   * and releases the others.
   */
  kind?: 'NO_SHOW_HOLD'
  bookingId?: string | null
  seatNo?: number | null
  /** TEMPORARY (GM-255): a test card an admin added; such a hold is settled by the simulator. */
  testCard?: { brand: string; last4: string }
}

/** TEMPORARY (GM-255). Test card numbers only; never stored. */
export interface TestCardRequest {
  cardNumber: string
  expMonth: number
  expYear: number
  cvc: string
}

/** A collection or release the gateway refused, waiting for a person. */
export interface PaymentFailure {
  id: number
  /** `capture`: a no-show penalty was not collected. `void`: a hold was not released. */
  action: 'capture' | 'void'
  amount: number | null
  message: string
  at: string
  attempts: number
  holdId: string | null
  bookingId: string | null
  bookingRef: string | null
  seatNo: number | null
  minglerName: string | null
  restaurantName: string | null
  eventName: string | null
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
  /** Absent on older servers. */
  paymentFailures?: PaymentFailure[]
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
  /** One hold per seat; empty when the restaurant's no-show penalty is zero. */
  holds: EscrowItem[]
  heldTotalPkr: number
}
