import { httpClient } from '../../../../shared/api/httpClient'
import { PARTNER_IT_ENDPOINTS } from './constants'
import { buildInterestTablesQuery } from './params'
import type {
  BookingDetail,
  CancelBookingResponse,
  CancelInviteResponse,
  InterestTableBookingRow,
  InterestTableDetail,
  InterestTableMenuOption,
  InterestTablesPage,
  InterestTablesParams,
  InviteesResponse,
  MinglerProfile,
} from './types'

/**
 * J6F's nine endpoints.
 *
 * Seven reads and exactly two writes: the partner may cancel a booking and cancel
 * an invite, and nothing else (BR-02). No restaurant id on any route — scope comes
 * from the access token (F1 BR-04).
 */
export const partnerInterestTablesService = {
  /**
   * The grid (US-01). Server-side paged, filterable by status.
   *
   * Draft tables never appear — the server excludes them (BR-03), so there is no
   * client-side filtering to do and no Draft chip to offer.
   */
  listInterestTables: (params: InterestTablesParams = {}): Promise<InterestTablesPage> =>
    httpClient.get<InterestTablesPage>(
      `${PARTNER_IT_ENDPOINTS.interestTables}${buildInterestTablesQuery(params)}`,
    ),

  /**
   * The Overview tab (US-02).
   *
   * A Draft table 404s here too, even via a direct deep link — that is a
   * "not found" view rather than an error state.
   */
  getInterestTable: (itId: string): Promise<InterestTableDetail> =>
    httpClient.get<InterestTableDetail>(PARTNER_IT_ENDPOINTS.interestTableById(itId)),

  /** Assigned combos (US-02). Fully read-only — assigning them is admin-only. */
  listMenuOptions: (itId: string): Promise<{ items: InterestTableMenuOption[] }> =>
    httpClient.get<{ items: InterestTableMenuOption[] }>(PARTNER_IT_ENDPOINTS.menuOptions(itId)),

  /** Bookings for one interest table (US-03). Each row carries its own `cancellable`. */
  listBookings: (itId: string): Promise<{ items: InterestTableBookingRow[] }> =>
    httpClient.get<{ items: InterestTableBookingRow[] }>(PARTNER_IT_ENDPOINTS.bookings(itId)),

  /**
   * The Booking Details popup (US-03).
   *
   * Fetched on row click because the list row deliberately omits Topic and Time,
   * mirroring admin. The Restaurant row is absent from the payload by design.
   */
  getBooking: (bookingId: string): Promise<BookingDetail> =>
    httpClient.get<BookingDetail>(PARTNER_IT_ENDPOINTS.bookingById(bookingId)),

  /**
   * Cancels a booking (US-03). No body — the confirmation is client-side.
   *
   * The server releases the card hold or refunds the charge depending on where the
   * booking sits in its window, decrements the seat count, and notifies the
   * Mingler itself. The client triggers none of that.
   *
   * ACTIVE-only (BR-07); refused with `409 ERR_PROFILE_READ_ONLY` otherwise.
   */
  cancelBooking: (bookingId: string): Promise<CancelBookingResponse> =>
    httpClient.post<CancelBookingResponse>(PARTNER_IT_ENDPOINTS.cancelBooking(bookingId), {}),

  /**
   * Invitees (US-04).
   *
   * `inviteOnly` decides whether the tab exists at all: a non-Invite-Only table
   * answers `false` with an empty list, and the tab is hidden rather than showing
   * an empty state.
   */
  listInvitees: (itId: string): Promise<InviteesResponse> =>
    httpClient.get<InviteesResponse>(PARTNER_IT_ENDPOINTS.invitees(itId)),

  /**
   * Cancels an invite that has not converted to a booking (US-04).
   *
   * The Mingler is deliberately **not** notified (BR-06), so the confirm copy must
   * not imply otherwise. ACTIVE-only (BR-07).
   */
  cancelInvite: (itId: string, inviteeId: string): Promise<CancelInviteResponse> =>
    httpClient.post<CancelInviteResponse>(PARTNER_IT_ENDPOINTS.cancelInvite(itId, inviteeId), {}),

  /**
   * The Mingler profile modal (US-03, US-04).
   *
   * Reachable only for Minglers with a booking or invite on one of the caller's
   * interest tables; anything else 404s. That 404 is expected, not a bug, and
   * renders "Profile unavailable". No payment-card or loyalty data is returned.
   */
  getMingler: (minglerId: string): Promise<MinglerProfile> =>
    httpClient.get<MinglerProfile>(PARTNER_IT_ENDPOINTS.minglerById(minglerId)),
}
