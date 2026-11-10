import type {
  BOOKING_STATUSES,
  INVITE_STATUSES,
  PROMINGLER_KINDS,
  VISIBLE_IT_STATUSES,
} from './constants'

export type InterestTableStatus = (typeof VISIBLE_IT_STATUSES)[number]
export type BookingStatus = (typeof BOOKING_STATUSES)[number]
export type InviteStatus = (typeof INVITE_STATUSES)[number]
export type ProminglerKind = (typeof PROMINGLER_KINDS)[number]

/**
 * The Promingler on an interest table.
 *
 * `kind` decides the indicator: `ADMIN_ASSIGNED` renders the verified tick plus
 * the crown, `SELF_CLAIMED` the crown alone, `NONE` nothing at all (BR-10).
 */
export interface ProminglerRef {
  name: string
  kind: ProminglerKind
}

/**
 * The Promingler flag as the **bookings** read reports it — a different shape from
 * {@link ProminglerRef}, which is why they are separate types rather than one
 * reused loosely.
 */
export interface BookingPromingler {
  isProMingler: boolean
  kind: ProminglerKind
}

/**
 * One row of the grid (endpoint 1).
 *
 * Dates arrive **pre-formatted** `DD-MM-YYYY` and times as `h:mm A` in Asia/Karachi
 * — they are display strings, not parseable timestamps. See `format.ts`.
 *
 * There is no `restaurantName`: the partner is already scoped to one restaurant,
 * so the admin grid's restaurant column is hidden (BR-01).
 */
export interface InterestTableListItem {
  interestTableId: string
  name: string
  imageUrl: string | null
  date: string
  time: string
  maxGuests: number
  availabilityMode: string
  inviteOnly: boolean
  seatsBooked: number
  proMingler: ProminglerRef
  status: InterestTableStatus
}

export interface InterestTablesPage {
  items: InterestTableListItem[]
  page: number
  pageSize: number
  total: number
}

/** The Overview tab (endpoint 2). */
export interface InterestTableDetail {
  interestTableId: string
  name: string
  topic: string
  assignedTable: string
  startDate: string
  startTime: string
  durationMinutes: number
  minGuests: number
  maxGuests: number
  seatsLeft: number
  availabilityMode: string
  inviteOnly: boolean
  proMingler: ProminglerRef
  status: InterestTableStatus
  createdAt: string
  /**
   * Whether to show Copy Link. Read this rather than deriving it from `status` —
   * the server is the authority, and it is false for Cancelled (BR-09).
   */
  copyLinkEligible: boolean
}

/** One assigned combo course (endpoint 3). Same grouped shape as J6D's menu options. */
export interface InterestTableMenuCourse {
  course: string
  choose: number
  options: string[]
}

export interface InterestTableMenuOption {
  name: string
  pricePkr: number
  courses: InterestTableMenuCourse[]
}

/**
 * One booking row (endpoint 4).
 *
 * `billPkr` is null until the booking is charged — renders as an em dash, never
 * `PKR 0`.
 */
export interface InterestTableBookingRow {
  bookingId: string
  bookingRef: string
  minglerId: string
  minglerName: string
  proMingler: BookingPromingler
  menuOption: string
  date: string
  billPkr: number | null
  status: BookingStatus
  /**
   * Whether the × is offered. **Never recompute this.** The server's rule is
   * stricter than "not cancelled or completed" — it also excludes Promingler
   * bookings and some charge-retry states, so deriving it client-side would show
   * buttons that 409.
   */
  cancellable: boolean
}

/**
 * The Booking Details popup (endpoint 5).
 *
 * Fetched on row click rather than rendered from the row, because the list
 * deliberately omits Topic and Time — mirroring admin. No `restaurantName`
 * (BR-10).
 */
export interface BookingDetail {
  bookingId: string
  bookingRef: string
  minglerName: string
  interestTableName: string
  topic: string
  menuOption: string
  date: string
  time: string
  status: BookingStatus
  billPkr: number | null
}

export interface CancelBookingResponse {
  bookingId: string
  status: 'CANCELLED'
}

/** One invitee row (endpoint 7). `cancellable` is true only for `INVITED` (BR-06). */
export interface InviteeRow {
  inviteeId: string
  minglerId: string
  minglerName: string
  dateInvited: string
  inviteStatus: InviteStatus
  cancellable: boolean
}

/**
 * The Invited tab's payload.
 *
 * `inviteOnly` decides whether the tab is rendered **at all** — a non-Invite-Only
 * table answers `false` with an empty list, and the tab is hidden rather than
 * showing an empty state.
 */
export interface InviteesResponse {
  inviteOnly: boolean
  items: InviteeRow[]
}

export interface CancelInviteResponse {
  inviteeId: string
  inviteStatus: 'CANCELLED'
}

/**
 * One eating-preference question and its answers (endpoint 9).
 *
 * An **ordered array**, not a fixed object: the question set comes from an
 * admin-managed catalogue and changes, so it must be rendered by iterating rather
 * than by naming the questions. An empty `answers` renders "Not specified".
 */
export interface EatingPreference {
  question: string
  answers: string[]
}

/**
 * The Mingler profile modal (endpoint 9).
 *
 * No payment-card or loyalty data is returned, by design. A 404 is expected
 * rather than exceptional — a partner may only view Minglers with a booking or
 * invite on one of their own interest tables — and renders "Profile unavailable".
 */
export interface MinglerProfile {
  minglerId: string
  fullName: string
  isProMingler: boolean
  proMinglerKind: ProminglerKind
  /** Already formatted by the server, e.g. `10 Jan 2024`. */
  minglerSince: string
  accountStatus: string
  eatingPreferences: EatingPreference[]
}

/** Grid query params. Sort is accepted by the server but no UI drives it yet. */
export interface InterestTablesParams {
  page?: number
  pageSize?: number
  status?: InterestTableStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}
