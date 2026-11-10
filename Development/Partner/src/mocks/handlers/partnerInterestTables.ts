import { http } from 'msw'
import { PARTNER_IT_ENDPOINTS } from '../../app/modules/restaurants/partnerInterestTables/constants'
import {
  cancelMockBooking,
  cancelMockInvite,
  getMockBooking,
  getMockInterestTable,
  getMockMingler,
  listMockInterestTableBookings,
  listMockInterestTableMenuOptions,
  listMockInterestTables,
  listMockInvitees,
  markMockGuestsArrived,
  markMockNoShow,
} from '../data/partnerInterestTables'

/**
 * J6F's nine endpoints.
 *
 * The literal sub-paths (`/menu-options`, `/bookings`, `/invitees`,
 * `/invitees/:inviteeId/cancel`, `/cancel`) are registered **before** the
 * parameterised routes, or MSW matches them as an `:itId` / `:bookingId` and the
 * request silently hits the wrong handler — the same ordering J6A, J6B, J6D and
 * J6E all needed.
 */
export const partnerInterestTablesHandlers = [
  // ── Interest-table sub-resources, before /:itId ──────────────
  http.get(PARTNER_IT_ENDPOINTS.menuOptions(':itId'), ({ params }) =>
    listMockInterestTableMenuOptions(String(params.itId)),
  ),

  http.get(PARTNER_IT_ENDPOINTS.bookings(':itId'), ({ params }) =>
    listMockInterestTableBookings(String(params.itId)),
  ),

  http.post(PARTNER_IT_ENDPOINTS.cancelInvite(':itId', ':inviteeId'), ({ params }) =>
    cancelMockInvite(String(params.itId), String(params.inviteeId)),
  ),

  http.post(PARTNER_IT_ENDPOINTS.guestsArrived(':itId'), ({ params }) =>
    markMockGuestsArrived(String(params.itId)),
  ),

  http.get(PARTNER_IT_ENDPOINTS.invitees(':itId'), ({ params }) =>
    listMockInvitees(String(params.itId)),
  ),

  // ── The grid, then the detail ────────────────────────────────
  http.get(PARTNER_IT_ENDPOINTS.interestTables, ({ request }) =>
    listMockInterestTables(new URL(request.url)),
  ),

  http.get(PARTNER_IT_ENDPOINTS.interestTableById(':itId'), ({ params }) =>
    getMockInterestTable(String(params.itId)),
  ),

  // ── Bookings: cancel before the detail read ──────────────────
  http.post(PARTNER_IT_ENDPOINTS.markNoShow(':bookingId'), async ({ params, request }) =>
    markMockNoShow(
      String(params.bookingId),
      (await request.json().catch(() => ({}))) as Record<string, unknown>,
    ),
  ),

  http.post(PARTNER_IT_ENDPOINTS.cancelBooking(':bookingId'), ({ params }) =>
    cancelMockBooking(String(params.bookingId)),
  ),

  http.get(PARTNER_IT_ENDPOINTS.bookingById(':bookingId'), ({ params }) =>
    getMockBooking(String(params.bookingId)),
  ),

  // ── The Mingler profile modal ────────────────────────────────
  http.get(PARTNER_IT_ENDPOINTS.minglerById(':minglerId'), ({ params }) =>
    getMockMingler(String(params.minglerId)),
  ),
]
