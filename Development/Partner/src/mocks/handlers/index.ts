import { http, HttpResponse } from 'msw'
import {
  mockRoles,
  mockRestaurants,
  mockMinglers,
  mockBookingsChart,
  mockMinglerBookings,
  mockPaymentMethods,
  mockReviews,
  mockRestaurantBookings,
  mockInterestTables,
  mockAvailableSlots,
} from '../data/index'
import { partnerSessionHandlers } from './partnerSession'
import { partnerSignupHandlers } from './partnerSignup'
import { partnerAccountHandlers } from './partnerAccount'
import { partnerUsersHandlers } from './partnerUsers'
import { partnerWebhookHandlers } from './partnerWebhook'
import { partnerFinancesHandlers } from './partnerFinances'
import { partnerEscrowHandlers } from './partnerEscrow'
import { partnerPayoutAccountHandlers } from './partnerPayoutAccount'
import { partnerRestaurantProfileHandlers } from './partnerRestaurantProfile'
import { partnerMediaHandlers } from './partnerMedia'
import { partnerAmenitiesHandlers } from './partnerAmenities'
import { partnerMenuHandlers } from './partnerMenu'
import { partnerTablesHandlers } from './partnerTables'
import { partnerInterestTablesHandlers } from './partnerInterestTables'
import { partnerReviewsHandlers } from './partnerReviews'
import { partnerNotificationsHandlers } from './partnerNotifications'
import { mockCdnHandlers } from './mockCdn'
import { applyDemoProfileStatus } from '../data/partnerSession'
import { setMockProfileStatus } from '../data/partnerRestaurantProfile'
import type { RestaurantProfileStatus } from '../../app/modules/restaurants/partnerProfile/types'

const BASE = '/api'

/**
 * The prototype's lowercase `profileStatus` in J6A's vocabulary.
 *
 * The demo approve/reject simulator writes the prototype field, and both
 * fixtures have to move together: `applyDemoProfileStatus` sets only the
 * session's `route`, so on its own it produces a REJECTED route beside an ACTIVE
 * profile carrying no reasons. That incoherence is why a declined partner
 * shipped with an unreachable rejection banner — the two halves could never be
 * seen at once. Anything outside the four J6A states is ignored.
 */
const PROFILE_STATUS_BY_DEMO_STATUS: Record<string, RestaurantProfileStatus> = {
  draft: 'DRAFT',
  pending: 'PENDING',
  active: 'ACTIVE',
  rejected: 'REJECTED',
}

/**
 * The real, versioned Partner Portal API (`/api/v1/partner/*`) — F1 session,
 * J1 signup, J2 account, J3 users, J4 webhooks, J5 finances, J6A restaurant
 * profile, J6B media, J6C amenities, J6D menu options, J6E table timings,
 * J6F interest tables, J6G reviews and J7 notifications. These are the handlers to drop once the
 * backend is reachable.
 */
export const partnerHandlers = [
  ...partnerSessionHandlers,
  ...partnerSignupHandlers,
  ...partnerAccountHandlers,
  ...partnerUsersHandlers,
  ...partnerWebhookHandlers,
  ...partnerFinancesHandlers,
  ...partnerEscrowHandlers,
  ...partnerPayoutAccountHandlers,
  ...partnerRestaurantProfileHandlers,
  ...partnerMediaHandlers,
  ...partnerAmenitiesHandlers,
  ...partnerMenuHandlers,
  ...partnerTablesHandlers,
  ...partnerInterestTablesHandlers,
  ...partnerReviewsHandlers,
  ...partnerNotificationsHandlers,
  // Not an endpoint — the asset origins the fixtures' image URLs point at.
  ...mockCdnHandlers,
]

/**
 * Unversioned prototype endpoints. Their journey specs (J6x) are not built yet,
 * so these have no real counterpart and must stay mocked even when the partner
 * API is live — `/overview` fetches `/api/restaurants/:id` from here.
 */
export const legacyHandlers = [
  // Auth
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string }
    if (body.email && body.password) {
      return HttpResponse.json({
        user: {
          id: 'u1',
          name: 'Hira Mansoor',
          email: body.email,
          role: 'Super Admin',
          initials: 'HM',
        },
        token: 'mock-token',
      })
    }
    return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 })
  }),

  // Roles
  http.get(`${BASE}/roles`, () => HttpResponse.json(mockRoles)),
  http.post(`${BASE}/roles`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...body, id: `r${Date.now()}`, usersCount: 0 }, { status: 201 })
  }),
  http.put(`${BASE}/roles/:id`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(body)
  }),
  http.delete(`${BASE}/roles/:id`, () => HttpResponse.json({ success: true })),

  // Users moved to the versioned J3 API — see partnerUsersHandlers.

  // Interest Tables — in-memory mutating list so created tables persist
  // within the session.
  http.get(`${BASE}/interest-tables`, () => HttpResponse.json(mockInterestTables)),
  http.post(`${BASE}/interest-tables`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    // V8 SA6: Save as Draft → draft; Create and Publish → coming_soon or pending
    // per the chosen availability mode.
    const status = body.saveAsDraft
      ? 'draft'
      : body.mode === 'coming_soon'
        ? 'coming_soon'
        : 'pending'
    const created = {
      id: `it${Date.now()}`,
      confirmedCount: 0,
      minGuests: 4,
      createdDate: new Date().toISOString().slice(0, 10),
      // Booking window closes 72h after creation by default.
      expiresAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
      ...body,
      status,
    } as (typeof mockInterestTables)[number]
    mockInterestTables.unshift(created)
    return HttpResponse.json(created, { status: 201 })
  }),
  http.get(`${BASE}/interest-tables/:id/bookings`, ({ params }) => {
    const id = params.id as string
    const bookings = mockRestaurantBookings.filter((b) => b.interestTableId === id)
    return HttpResponse.json(bookings)
  }),
  http.get(`${BASE}/interest-tables/:id`, ({ params }) => {
    const id = params.id as string
    const found = mockInterestTables.find((tbl) => tbl.id === id)
    if (!found) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(found)
  }),
  // V8 SA6: update (AC14) — Draft tables are fully editable; post-publish edits
  // are constrained on the server in the real backend.
  http.patch(`${BASE}/interest-tables/:id`, async ({ params, request }) => {
    const id = params.id as string
    const body = (await request.json()) as Record<string, unknown>
    const idx = mockInterestTables.findIndex((tbl) => tbl.id === id)
    if (idx < 0) return new HttpResponse(null, { status: 404 })
    const merged = { ...mockInterestTables[idx], ...body }
    // V8 SA6 AC40: switching a Coming Soon table to Available Now makes it bookable.
    if (body.mode === 'available_now' && mockInterestTables[idx].status === 'coming_soon') {
      merged.status = 'pending'
    }
    mockInterestTables[idx] = merged
    return HttpResponse.json(mockInterestTables[idx])
  }),
  // V8 SA6 AC20: publish a Draft — Coming Soon mode → coming_soon, else pending.
  http.post(`${BASE}/interest-tables/:id/publish`, ({ params }) => {
    const id = params.id as string
    const tbl = mockInterestTables.find((t) => t.id === id)
    if (!tbl) return new HttpResponse(null, { status: 404 })
    tbl.status = tbl.mode === 'coming_soon' ? 'coming_soon' : 'pending'
    return HttpResponse.json(tbl)
  }),
  // V8 SA6 AC15: admin-cancel interest table (cascade/refund handled by backend).
  http.post(`${BASE}/interest-tables/:id/cancel`, ({ params }) => {
    const id = params.id as string
    const tbl = mockInterestTables.find((t) => t.id === id)
    if (!tbl) return new HttpResponse(null, { status: 404 })
    tbl.status = 'cancelled'
    mockRestaurantBookings
      .filter((b) => b.interestTableId === id)
      .forEach((b) => {
        if (b.status === 'pending' || b.status === 'confirmed') b.status = 'cancelled'
      })
    return HttpResponse.json(tbl)
  }),
  // V8 SA6 AC14: change the Promingler on a published table.
  http.post(`${BASE}/interest-tables/:id/promingler`, async ({ params, request }) => {
    const id = params.id as string
    const body = (await request.json()) as { prominglerId?: string }
    const tbl = mockInterestTables.find((t) => t.id === id)
    if (!tbl) return new HttpResponse(null, { status: 404 })
    if (body.prominglerId) {
      const m = mockMinglers.find((x) => x.id === body.prominglerId)
      tbl.promingler = m
        ? { id: m.id, name: m.name, email: m.email ?? '' }
        : { id: body.prominglerId, name: 'Unknown', email: '' }
    }
    return HttpResponse.json(tbl)
  }),
  // V8 SA6 AC16/AC22: delete an interest table.
  http.delete(`${BASE}/interest-tables/:id`, ({ params }) => {
    const id = params.id as string
    const idx = mockInterestTables.findIndex((t) => t.id === id)
    if (idx >= 0) mockInterestTables.splice(idx, 1)
    return HttpResponse.json({ success: true })
  }),
  // V8 SA6 AC30: admin-cancel a single Mingler booking.
  http.post(`${BASE}/interest-tables/:id/bookings/:bookingId/cancel`, ({ params }) => {
    const bookingId = params.bookingId as string
    const bk = mockRestaurantBookings.find((b) => b.id === bookingId || b.bookingId === bookingId)
    if (bk) bk.status = 'cancelled'
    return HttpResponse.json({ success: true })
  }),
  // V8 SA6 AC6: read-only partner availability slots for a restaurant.
  http.get(`${BASE}/restaurants/:id/available-slots`, ({ params }) => {
    const id = params.id as string
    return HttpResponse.json(mockAvailableSlots.filter((s) => s.restaurantId === id))
  }),

  // Restaurants
  http.get(`${BASE}/restaurants`, () => HttpResponse.json(mockRestaurants)),
  http.get(`${BASE}/restaurants/:id`, ({ params }) => {
    const r = mockRestaurants.find((x) => x.id === params.id)
    return r ? HttpResponse.json(r) : HttpResponse.json({ message: 'Not found' }, { status: 404 })
  }),
  http.get(`${BASE}/restaurants/:id/bookings`, () => HttpResponse.json(mockRestaurantBookings)),
  http.put(`${BASE}/restaurants/:id/suspend`, () => HttpResponse.json({ success: true })),
  // Update editable restaurant fields — mutate in-memory so edits persist for the session.
  http.put(`${BASE}/restaurants/:id`, async ({ params, request }) => {
    const id = params.id as string
    const body = (await request.json()) as Record<string, unknown>
    const idx = mockRestaurants.findIndex((r) => r.id === id)
    if (idx < 0) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    mockRestaurants[idx] = {
      ...mockRestaurants[idx],
      ...body,
    } as (typeof mockRestaurants)[number]
    // Keep the demo session and the J6A profile in step: the real backend
    // derives `route` from restaurants.status and serves the decline history off
    // the same row, so a status change here has to move both mocks.
    if (typeof body.profileStatus === 'string') {
      applyDemoProfileStatus(body.profileStatus)
      const profileStatus = PROFILE_STATUS_BY_DEMO_STATUS[body.profileStatus.toLowerCase()]
      if (profileStatus) setMockProfileStatus(profileStatus)
    }
    return HttpResponse.json(mockRestaurants[idx])
  }),

  // Minglers
  http.get(`${BASE}/minglers`, () => HttpResponse.json(mockMinglers)),
  http.get(`${BASE}/minglers/:id`, ({ params }) => {
    const m = mockMinglers.find((x) => x.id === params.id)
    return m ? HttpResponse.json(m) : HttpResponse.json({ message: 'Not found' }, { status: 404 })
  }),
  http.get(`${BASE}/minglers/:id/bookings`, () => HttpResponse.json(mockMinglerBookings)),
  http.get(`${BASE}/minglers/:id/payment-methods`, () => HttpResponse.json(mockPaymentMethods)),
  http.get(`${BASE}/minglers/:id/reviews`, () => HttpResponse.json(mockReviews)),
  http.put(`${BASE}/minglers/:id/suspend`, () => HttpResponse.json({ success: true })),
  // V8 SA8: toggle Promingler designation (mutates in-memory so the list reflects it).
  http.put(`${BASE}/minglers/:id/promingler`, async ({ params, request }) => {
    const body = (await request.json()) as { isPromingler?: boolean }
    const m = mockMinglers.find((x) => x.id === params.id) as Record<string, unknown> | undefined
    if (!m) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    m.isPromingler = !!body.isPromingler
    return HttpResponse.json({ success: true })
  }),
  http.put(`${BASE}/reviews/:id/visibility`, () => HttpResponse.json({ success: true })),
  http.delete(`${BASE}/reviews/:id`, () => HttpResponse.json({ success: true })),

  // Finances moved to the versioned J5 API — see partnerFinancesHandlers.

  // Dashboard stats
  http.get(`${BASE}/dashboard/stats`, () =>
    HttpResponse.json({
      activeRestaurants: 7,
      pendingApprovals: 5,
      activeMinglers: 9,
      earnings: 284600,
      oldestPendingDays: 7,
      trendRestaurants: '+4%',
      trendMinglers: '+12%',
      trendEarnings: '+8%',
    }),
  ),
  // Webhooks moved to the versioned J4 API — see partnerWebhookHandlers.

  http.get(`${BASE}/dashboard/bookings-chart`, () => HttpResponse.json(mockBookingsChart)),
  http.get(`${BASE}/dashboard/revenue-chart`, () =>
    HttpResponse.json({
      total: 148320,
      commissions: 118656,
      penalties: 29664,
      commissionPct: 80,
      penaltyPct: 20,
      trend: '+11%',
    }),
  ),
]

/** Everything — used by the Vitest server so tests cover both surfaces. */
export const handlers = [...partnerHandlers, ...legacyHandlers]
