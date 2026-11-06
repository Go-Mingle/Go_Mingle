import { http, HttpResponse } from 'msw'
import { rolesHandlers } from './roles'
import { authHandlers } from './auth'
import { usersHandlers } from './users'
import { categoriesHandlers } from './categories'
import { amenitiesHandlers } from './amenities'
import { preferenceQuestionsHandlers } from './preference-questions'
import { restaurantsHandlers } from './restaurants'
import { interestTablesV1Handlers } from './interest-tables'
import { interestsHandlers } from './interests'
import { approvalsHandlers } from './approvals'
import { minglersHandlers } from './minglers'
import { reviewsHandlers } from './reviews'
import { bookingsHandlers } from './bookings'
import { notificationsHandlers } from './notifications'
import { uploadsHandlers } from './uploads'
import { escrowHandlers } from './escrow'
import type {
  UpdateEarnRatePayload,
  UpdateRedeemRatePayload,
} from '../../app/modules/loyalty/types'
import {
  mockRestaurants,
  mockApplications,
  mockMinglers,
  mockFinances,
  mockChangeLogs,
  mockLoyalty,
  mockBookingsChart,
  mockRestaurantBookings,
  mockInterestTopics,
  mockInterestTables,
  mockInterests,
  type Interest,
} from '../data/index'

const BASE = '/api'

// Auth mocks kept for the Node test server only.
// The browser worker excludes these so auth requests pass through
// the Vite proxy to the real backend (localhost:3040).
const authMocks = [
  ...authHandlers,

  http.post(`${BASE}/v1/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string }
    if (body.email === 'admin@gomingle.com' && body.password === 'Admin@123') {
      return HttpResponse.json({
        user: {
          id: 'u1',
          name: 'Hira Mansoor',
          email: body.email,
          role: 'Super Admin',
          initials: 'HM',
        },
        token: 'mock-jwt-admin-test',
      })
    }
    return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 })
  }),

  // No refresh endpoint is mocked on purpose: FE1 BR-02 renews client↔Cognito
  // via the SDK, and no backend refresh endpoint exists on any surface.
]

// Interest Topics + Interests catalogue — versioned handlers (/api/v1/topics/*, /api/v1/interests)
// Excluded from browserHandlers so the browser calls the real NestJS backend (spec J7A).
const topicsHandlers = [
  http.get(`${BASE}/v1/topics`, ({ request }) => {
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
    const rawSize = parseInt(url.searchParams.get('pageSize') ?? '25', 10)
    const pageSize = [25, 50, 100].includes(rawSize) ? rawSize : 25
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const sortOrder = url.searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc'

    let items = [...mockInterestTopics]
    if (q) items = items.filter((t) => t.name.toLowerCase().includes(q))
    items.sort((a, b) =>
      sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
    )
    const totalRecords = items.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    const pagedItems = items.slice((page - 1) * pageSize, page * pageSize)
    return HttpResponse.json({
      success: true,
      data: { items: pagedItems, pagination: { page, pageSize, totalRecords, totalPages } },
    })
  }),
  // Active topics — lightweight dropdown source (id/name/graphicUrl only).
  // Registered before `/v1/topics/:id` so `:id` does not capture "active".
  http.get(`${BASE}/v1/topics/active`, () =>
    HttpResponse.json({
      success: true,
      data: {
        items: mockInterestTopics.map((t) => ({
          id: t.id,
          name: t.name,
          graphicUrl: t.graphicUrl,
        })),
      },
    }),
  ),
  http.get(`${BASE}/v1/topics/:id`, ({ params }) => {
    const found = mockInterestTopics.find((t) => t.id === params.id)
    if (!found)
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_TOPIC_NOT_FOUND' } },
        { status: 404 },
      )
    return HttpResponse.json({ success: true, data: found })
  }),
  http.post(`${BASE}/v1/topics`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const interestIds = (body.interestIds as string[] | undefined) ?? []
    const created: (typeof mockInterestTopics)[number] = {
      id: `t${Date.now()}`,
      name: (body.name as string) ?? '',
      description: (body.description as string | undefined) ?? null,
      // Create now sends a `graphicKey` (signed-url storage key); the backend
      // resolves it to a display URL. Mirror that here for the returned record.
      graphicUrl: body.graphicKey ? `https://mock-cdn.local/${body.graphicKey as string}` : null,
      interests: interestIds
        .map((id) => mockInterests.find((i) => i.id === id))
        .filter((i): i is Interest => Boolean(i)),
      interestTablesCount: 0,
      createdAt: new Date().toISOString(),
    }
    mockInterestTopics.push(created)
    return HttpResponse.json({ success: true, data: created }, { status: 201 })
  }),
  http.patch(`${BASE}/v1/topics/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    const idx = mockInterestTopics.findIndex((t) => t.id === params.id)
    if (idx < 0)
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_TOPIC_NOT_FOUND' } },
        { status: 404 },
      )
    const existing = mockInterestTopics[idx]
    const updatedInterests = body.interestIds
      ? (body.interestIds as string[])
          .map((id) => mockInterests.find((i) => i.id === id))
          .filter((i): i is Interest => Boolean(i))
      : existing.interests
    mockInterestTopics[idx] = {
      ...existing,
      ...(body.name !== undefined && { name: body.name as string }),
      ...(body.description !== undefined && { description: body.description as string | null }),
      // Edit sends `graphicKey` only when the image was replaced.
      ...(body.graphicKey !== undefined && {
        graphicUrl: `https://mock-cdn.local/${body.graphicKey as string}`,
      }),
      interests: updatedInterests,
    }
    return HttpResponse.json({ success: true, data: mockInterestTopics[idx] })
  }),
  http.delete(`${BASE}/v1/topics/:id`, ({ params }) => {
    const idx = mockInterestTopics.findIndex((t) => t.id === params.id)
    if (idx >= 0) mockInterestTopics.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),
  // GET /api/v1/interests is now served by interestsHandlers (see ./interests.ts).
]

// Loyalty — versioned handlers matching spec J8 endpoints.
// Excluded from browserHandlers so the browser calls the real NestJS backend.
const loyaltyHandlers = [
  http.get(`${BASE}/v1/loyalty-configuration`, () =>
    HttpResponse.json({ success: true, data: { ...mockLoyalty } }),
  ),

  http.patch(`${BASE}/v1/loyalty-configuration/earn-rate`, async ({ request }) => {
    const body = (await request.json()) as UpdateEarnRatePayload
    Object.assign(mockLoyalty, body)
    mockLoyalty.earnUpdatedAt = new Date().toISOString()
    mockLoyalty.earnUpdatedBy = { id: 'u-mock', name: 'Test Admin' }
    return HttpResponse.json({ success: true, data: { ...mockLoyalty } })
  }),

  http.patch(`${BASE}/v1/loyalty-configuration/redeem-rate`, async ({ request }) => {
    const body = (await request.json()) as UpdateRedeemRatePayload
    Object.assign(mockLoyalty, body)
    mockLoyalty.redeemUpdatedAt = new Date().toISOString()
    mockLoyalty.redeemUpdatedBy = { id: 'u-mock', name: 'Test Admin' }
    return HttpResponse.json({ success: true, data: { ...mockLoyalty } })
  }),
]

export const handlers = [
  // Auth mocks (test server only — browser passes these through to real backend)
  ...authMocks,

  // Roles — versioned handlers (GET/POST/PATCH/DELETE /api/v1/roles/*)
  ...rolesHandlers,

  // Users — versioned handlers (/api/v1/users/*)
  ...usersHandlers,

  // Categories — versioned handlers (/api/v1/categories/*)
  ...categoriesHandlers,

  // Interest Topics catalogue — versioned handlers (spec J7A)
  ...topicsHandlers,

  // Interests — versioned CRUD handlers (/api/v1/interests/*)
  ...interestsHandlers,

  // Interest Tables — in-memory mutating list so created tables persist
  // within the session.
  http.get(`${BASE}/interest-tables`, () => HttpResponse.json(mockInterestTables)),
  http.post(`${BASE}/interest-tables`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const created = {
      id: `it${Date.now()}`,
      status: 'pending' as const,
      confirmedCount: 0,
      createdDate: new Date().toISOString().slice(0, 10),
      // Booking window closes 72h after creation by default.
      expiresAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
      ...body,
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

  // Amenities — versioned handlers (/api/v1/amenities/*)
  ...amenitiesHandlers,

  // Preference Questions — versioned handlers (/api/v1/preference-questions/*)
  ...preferenceQuestionsHandlers,

  // Loyalty — versioned handlers (spec J8). Excluded from browserHandlers so
  // the browser calls the real NestJS backend.
  ...loyaltyHandlers,

  // Restaurants — versioned handlers (/api/v1/restaurants/*) (spec J10A)
  ...restaurantsHandlers,

  // Interest Tables v1 — versioned handlers (spec J10B)
  //   GET/POST /api/v1/restaurants/:rid/interest-tables
  //   GET      /api/v1/interest-tables/:id
  //   GET      /api/v1/interest-tables/:id/menu-options
  //   GET      /api/v1/restaurants/:rid/tables/:tid/availability-check
  ...interestTablesV1Handlers,

  // Uploads — signed-URL provider (POST /api/v1/uploads/signed-url). Excluded
  // from browserHandlers so the browser hits the real backend; Node tests use these.
  ...uploadsHandlers,

  // Approval queue — real J9 contract (/api/v1/admin/approvals/*). Excluded from
  // browserHandlers so the app hits the real backend; Node tests use these.
  ...approvalsHandlers,

  // Safepay escrow ledger (/api/v1/escrow/*). Excluded from browserHandlers so
  // the app hits the real backend; Node tests use these.
  ...escrowHandlers,

  // Legacy approval-queue mocks (old /api/applications shape) — retained for any
  // remaining consumers; superseded by approvalsHandlers above.
  http.get(`${BASE}/applications`, () => HttpResponse.json(mockApplications)),
  http.get(`${BASE}/applications/:id`, ({ params }) => {
    const a = mockApplications.find((x) => x.id === params.id)
    return a ? HttpResponse.json(a) : HttpResponse.json({ message: 'Not found' }, { status: 404 })
  }),
  http.post(`${BASE}/applications/:id/approve`, () => HttpResponse.json({ success: true })),
  http.post(`${BASE}/applications/:id/reject`, () => HttpResponse.json({ success: true })),

  // Minglers — versioned handlers (/api/v1/minglers/*). Kept active in the
  // browser worker since the real minglers backend is still under
  // development for everything except the list endpoint (which now mirrors
  // the real paginated contract).
  ...minglersHandlers,

  // Reviews — owned by J10D (reviews table + soft-delete); consumed here as
  // the Mingler-filtered read view + read-only detail + soft-delete.
  //   GET    /api/v1/admin/reviews?minglerId=
  //   GET    /api/v1/reviews/:id
  //   DELETE /api/v1/reviews/:id
  ...reviewsHandlers,

  // Bookings — owned by a separate module (J10C), consumed read-only here
  // scoped by minglerId for the Mingler detail page's Bookings tab.
  ...bookingsHandlers,

  // Notifications — versioned handlers (/api/v1/notifications/*) (spec J13).
  // Kept active in the browser worker so the global topbar bell keeps working
  // in frontend-only dev; the Node test server uses these for coverage.
  ...notificationsHandlers,

  // Finances — items joined from mockRestaurants/mockMinglers, shaped like
  // the real admin API's { items, pagination } envelope.
  http.get(`${BASE}/v1/admin/finances`, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('pageSize') ?? 25)
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    const sortBy = url.searchParams.get('sortBy')
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

    if (dateFrom && dateTo && dateFrom > dateTo) {
      return HttpResponse.json({ error: { message: 'Invalid date range.' } }, { status: 400 })
    }

    let items = mockFinances.map((f) => {
      const restaurant = mockRestaurants.find((r) => r.id === f.restaurantId)
      const mingler = mockMinglers.find((m) => m.name === f.mingler)
      return {
        bookingRef: f.bookingId,
        restaurant: {
          id: f.restaurantId,
          name: restaurant?.name ?? f.restaurant,
          city: restaurant?.city ?? f.restaurantCity ?? null,
          address: restaurant?.address ?? f.restaurantAddress ?? null,
          lat: null,
          lng: null,
          avatarUrl: restaurant?.avatarUrl ?? null,
        },
        mingler: {
          id: mingler?.id ?? f.mingler,
          name: f.mingler,
        },
        interestTableName: f.interestTableTopic ?? '',
        date: f.date,
        eventStart: '19:30',
        eventEnd: '21:30',
        totalAmountPkr: f.totalAmount,
        partnerSharePkr: f.partnerShare,
        gomingleSharePkr: f.gomingleShare,
      }
    })

    // CR-62 / MET-753 — each searchable column has its own parameter and they are
    // AND-combined, replacing the single `q` + `searchField` pair.
    const searchableByField: Record<string, (item: (typeof items)[number]) => string> = {
      bookingRef: (item) => item.bookingRef,
      restaurant: (item) => item.restaurant.name,
      mingler: (item) => item.mingler.name,
      interestTable: (item) => item.interestTableName,
    }
    for (const [field, getter] of Object.entries(searchableByField)) {
      const term = (url.searchParams.get(field) ?? '').trim().slice(0, 100).toLowerCase()
      if (!term) continue
      items = items.filter((item) => getter(item).toLowerCase().includes(term))
    }

    // item.date is "DD-MM-YYYY" (matches the real API); dateFrom/dateTo are ISO
    // "YYYY-MM-DD" — neither sorts nor compares correctly as a raw string, so
    // convert to a comparable ISO form first.
    const toComparableDate = (ddMmYyyy: string) => {
      const [day, month, year] = ddMmYyyy.split('-')
      return `${year}-${month}-${day}`
    }

    if (dateFrom) items = items.filter((item) => toComparableDate(item.date) >= dateFrom)
    if (dateTo) items = items.filter((item) => toComparableDate(item.date) <= dateTo)

    const sortableByField: Record<string, (item: (typeof items)[number]) => string | number> = {
      bookingRef: (item) => item.bookingRef,
      restaurant: (item) => item.restaurant.name,
      mingler: (item) => item.mingler.name,
      interestTable: (item) => item.interestTableName,
      date: (item) => toComparableDate(item.date),
      total: (item) => item.totalAmountPkr,
    }
    const sortGetter = sortableByField[sortBy ?? 'date'] ?? sortableByField.date
    items = [...items].sort((a, b) => {
      const [va, vb] = [sortGetter(a), sortGetter(b)]
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortOrder === 'asc' ? cmp : -cmp
    })

    const totalRecords = items.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    const start = (page - 1) * pageSize

    return HttpResponse.json({
      success: true,
      data: {
        items: items.slice(start, start + pageSize),
        pagination: { page, pageSize, totalRecords, totalPages },
      },
    })
  }),

  http.get(`${BASE}/v1/admin/finances/export`, () => {
    // The export endpoint returns a signed URL to the generated CSV; the client
    // downloads from that URL rather than receiving the file bytes here.
    return HttpResponse.json({
      success: true,
      data: {
        url: 'https://s3.amazonaws.com/admin-exports/finances-exports/finances-16-06-2026-1430.csv',
        expiresIn: 300,
      },
    })
  }),

  http.get(`${BASE}/v1/admin/finances/:bookingId`, ({ params }) => {
    const record = mockFinances.find((f) => f.bookingId === params.bookingId)
    if (!record) {
      return HttpResponse.json(
        { success: false, error: { message: 'Booking not found' } },
        { status: 404 },
      )
    }
    return HttpResponse.json({
      success: true,
      data: {
        bookingRef: record.bookingId,
        restaurant: record.restaurant,
        mingler: record.mingler,
        interestTableName: record.interestTableTopic ?? '',
        date: record.date,
        eventStart: '19:30',
        eventEnd: '21:30',
        partnerSharePkr: record.partnerShare,
        gomingleSharePkr: record.gomingleShare,
        loyaltyRedeemedPkr: record.loyaltyRedeemed?.pkr ?? 0,
        loyaltyRedeemedPoints: record.loyaltyRedeemed?.pts ?? 0,
        totalAmountPkr: record.totalAmount,
      },
    })
  }),

  // Change Log
  http.get(`${BASE}/v1/change-log`, () => HttpResponse.json(mockChangeLogs)),

  // Timer Settings
  http.get(`${BASE}/timer-settings`, () => HttpResponse.json([])),

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

// ── Browser Service Worker handlers ─────────────────────────────────────────
//
// The following module groups are EXCLUDED from the browser worker so their
// requests pass through the Vite proxy (VITE_API_BASE_URL → localhost:3040)
// to the real NestJS backend:
//
//   • authMocks                    — login, token refresh               (spec J1)
//   • rolesHandlers                — /api/v1/roles/*                    (spec J2)
//   • usersHandlers                — /api/v1/users/*                    (spec J3)
//   • categoriesHandlers           — /api/v1/categories/*               (spec J4)
//   • amenitiesHandlers            — /api/v1/amenities/*                (spec J5)
//   • preferenceQuestionsHandlers  — /api/v1/preference-questions/*     (spec J6)
//   • topicsHandlers               — /api/v1/topics/*                    (spec J7A)
//   • interestsHandlers            — /api/v1/interests/*                 (spec J7A)
//   • loyaltyHandlers              — /api/v1/loyalty-configuration/*    (spec J8)
//   • restaurantsHandlers          — /api/v1/restaurants/*              (spec J10A)
//   • interestTablesV1Handlers     — /api/v1/interest-tables (cross-restaurant
//                                      master list, CR-43), /api/v1/interest-tables/*,
//                                      /api/v1/restaurants/:rid/interest-tables,
//                                      /api/v1/restaurants/:rid/tables/:tid/availability-check
//                                      (spec J10B)
//   • uploadsHandlers              — /api/v1/uploads/signed-url
//   • reviewsHandlers              — /api/v1/restaurants/:rid/reviews,
//                                      /api/v1/reviews/*                   (spec J10D)
//   • bookingsHandlers             — /api/v1/admin/bookings, /:id          (spec J10C)
//
// To add a new module to the real-backend list, append it to the filter below
// AND document it in this comment block.
//
// All remaining handlers stay active in the browser worker to simulate
// modules that are still under development (minglers, etc.).
export const browserHandlers = handlers.filter(
  (h) =>
    !authMocks.includes(h) &&
    !escrowHandlers.includes(h) &&
    !rolesHandlers.includes(h) &&
    !usersHandlers.includes(h) &&
    !categoriesHandlers.includes(h) &&
    !amenitiesHandlers.includes(h) &&
    !preferenceQuestionsHandlers.includes(h) &&
    !topicsHandlers.includes(h) &&
    !interestsHandlers.includes(h) &&
    !loyaltyHandlers.includes(h) &&
    !restaurantsHandlers.includes(h) &&
    !interestTablesV1Handlers.includes(h) &&
    !uploadsHandlers.includes(h) &&
    !approvalsHandlers.includes(h) &&
    !reviewsHandlers.includes(h) &&
    !bookingsHandlers.includes(h),
)
