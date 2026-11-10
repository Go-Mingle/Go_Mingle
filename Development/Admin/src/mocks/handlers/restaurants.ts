import { http, HttpResponse } from 'msw'
import type {
  RestaurantListResponse,
  RestaurantListItem,
  RestaurantDetail,
  RestaurantContact,
  RestaurantContactsResponse,
  RestaurantTablesResponse,
  MenuOptionsResponse,
  ChangeCategoryResult,
  RestaurantMediaItem,
  RestaurantMediaResponse,
  SuspendResult,
  UnsuspendResult,
  ActiveBookingsCount,
} from '../../app/modules/restaurants/restaurantApi.types'
import { mockRestaurants, mockCategories } from '../data/index'
import { mockAmenities } from '../data/amenities'

const BASE = '/api/v1/restaurants'

// CR-45 / F1 BR-09 — Partner-Portal DRAFT restaurants are excluded from every
// Admin read surface. The directory's base filter is status IN (ACTIVE,
// SUSPENDED): PENDING/REJECTED belong to the J9 approval queue, and DRAFT is
// not an Admin-facing row at all. `statuses[]` is an allow-list over the same
// two values, so it can never widen the base filter.
const DIRECTORY_STATUSES = ['ACTIVE', 'SUSPENDED']

function notFound() {
  return HttpResponse.json(
    {
      success: false,
      error: { code: 'ERR_RESTAURANT_NOT_FOUND', message: 'Restaurant not found.' },
    },
    { status: 404 },
  )
}

/**
 * Per-restaurant reads resolve for every status except DRAFT, which 404s as if
 * the restaurant did not exist. PENDING/REJECTED still resolve so the
 * pre-approval detail shell keeps rendering.
 */
function findReadableRestaurant(id: unknown) {
  const r = mockRestaurants.find((x) => x.id === id)
  return r && r.status !== 'DRAFT' ? r : undefined
}

function buildMedia(kind: string): RestaurantMediaItem[] {
  if (kind === 'DOCUMENT') {
    return [
      {
        kind: 'DOCUMENT',
        name: 'trade-licence.pdf',
        contentType: 'application/pdf',
        sortOrder: 0,
        url: 'https://example.com/media/trade-licence.pdf',
      },
      {
        kind: 'DOCUMENT',
        name: 'food-safety-cert.pdf',
        contentType: 'application/pdf',
        sortOrder: 1,
        url: 'https://example.com/media/food-safety-cert.pdf',
      },
    ]
  }
  if (kind === 'VIDEO') {
    return [
      {
        kind: 'VIDEO',
        name: 'venue-tour.mp4',
        contentType: 'video/mp4',
        sortOrder: 0,
        url: 'https://example.com/media/venue-tour.mp4',
      },
    ]
  }
  return [
    {
      kind: 'PHOTO',
      name: 'dining-hall.jpg',
      contentType: 'image/jpeg',
      sortOrder: 0,
      url: 'https://example.com/media/dining-hall.jpg',
    },
    {
      kind: 'PHOTO',
      name: 'terrace.jpg',
      contentType: 'image/jpeg',
      sortOrder: 1,
      url: 'https://example.com/media/terrace.jpg',
    },
  ]
}

/**
 * CR-56 — the fixture rows carry optional title/email/phone; the API always
 * sends the key, with an explicit null when it has no value.
 */
function toContact(c: {
  id: string
  name: string
  title?: string | null
  email?: string | null
  phone?: string | null
}): RestaurantContact {
  return {
    id: c.id,
    name: c.name,
    title: c.title ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
  }
}

const DAY_OF_WEEK: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

function toListItem(r: (typeof mockRestaurants)[number]): RestaurantListItem {
  const cat = mockCategories.find((c) => c.id === r.categoryId)
  return {
    id: r.id,
    name: r.name,
    cuisine: r.cuisine ?? null,
    city: r.city ?? null,
    category: cat ? { id: cat.id, name: cat.name } : null,
    confirmedBookings: r.bookings,
    joinedAt: r.joinedDate,
    status: r.status as 'ACTIVE' | 'SUSPENDED',
    visibleOnApp: r.mingleFriendly ?? false,
    avatarUrl: r.avatarUrl ?? null,
  }
}

function toDetail(r: (typeof mockRestaurants)[number]): RestaurantDetail {
  const cat = mockCategories.find((c) => c.id === r.categoryId)
  const alcoholPolicy = r.alcoholPolicy?.toLowerCase() ?? ''
  const servesAlcohol = alcoholPolicy.includes('full bar')
    ? true
    : alcoholPolicy.includes('halal')
      ? false
      : null

  return {
    id: r.id,
    name: r.name,
    status: r.status,
    visibleOnApp: r.mingleFriendly ?? false,
    category: cat ? { id: cat.id, name: cat.name } : null,
    cuisine: r.cuisine ?? null,
    description: r.description ?? null,
    seatingCapacity: r.seatingCapacity ?? null,
    phone: r.contactPhone ?? null,
    email: r.ownerEmail ?? null,
    website: r.website ?? null,
    fullAddress: r.address ?? null,
    areaDistrict: r.area ?? null,
    city: r.city ?? null,
    latitude: (r as { latitude?: number | null }).latitude ?? null,
    longitude: (r as { longitude?: number | null }).longitude ?? null,
    ownerName: r.owner ?? null,
    ownerPhone: r.phone ?? null,
    ownerEmail: r.ownerEmail ?? null,
    businessRegNo: r.tradeLicence ?? null,
    servesAlcohol,
    houseRules: r.houseNotes ?? null,
    dressCode: r.dressCode ?? null,
    joinedAt: r.joinedDate,
    confirmedBookings: r.bookings,
    avatarUrl: r.avatarUrl ?? null,
    menuPdfUrl: (r as { menuPdfUrl?: string | null }).menuPdfUrl ?? null,
  }
}

export const restaurantsHandlers = [
  // GET /api/v1/restaurants — paginated list with sort/filter/search
  http.get(BASE, ({ request }) => {
    const url = new URL(request.url)

    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
    const rawSize = parseInt(url.searchParams.get('pageSize') ?? '10', 10)
    const pageSize: 10 | 25 | 50 = ([10, 25, 50] as const).includes(rawSize as 10 | 25 | 50)
      ? (rawSize as 10 | 25 | 50)
      : 10

    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const sortBy = url.searchParams.get('sortBy') ?? 'name'
    const sortOrder = url.searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc'
    const categoryIds = url.searchParams.getAll('categoryIds')
    const cities = url.searchParams.get('cities')
    const statuses = url.searchParams.getAll('statuses')

    // Anything outside the allow-list is rejected outright — notably PENDING and
    // REJECTED, which used to validate and return an empty page.
    if (statuses.some((s) => !DIRECTORY_STATUSES.includes(s))) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_VALIDATION',
            message: `Each status must be one of: ${DIRECTORY_STATUSES.join(', ')}.`,
          },
        },
        { status: 422 },
      )
    }

    // Base filter first, so counts and pagination totals never see a
    // DRAFT/PENDING/REJECTED row.
    let items = mockRestaurants.filter((r) => DIRECTORY_STATUSES.includes(r.status))

    if (categoryIds.length) items = items.filter((r) => categoryIds.includes(r.categoryId))
    if (cities)
      items = items.filter((r) => (r.city ?? '').toLowerCase().includes(cities.toLowerCase()))
    if (statuses.length) items = items.filter((r) => statuses.includes(r.status))
    if (q) {
      items = items.filter((r) => r.name.toLowerCase().includes(q))
    }

    items.sort((a, b) => {
      let aVal: string | number
      let bVal: string | number
      switch (sortBy) {
        case 'cuisine':
          aVal = a.cuisine ?? ''
          bVal = b.cuisine ?? ''
          break
        case 'city':
          aVal = a.city ?? ''
          bVal = b.city ?? ''
          break
        case 'category':
          aVal = a.category ?? ''
          bVal = b.category ?? ''
          break
        case 'joinedAt':
          aVal = a.joinedDate
          bVal = b.joinedDate
          break
        case 'status':
          aVal = a.status
          bVal = b.status
          break
        case 'bookings':
          aVal = a.bookings
          bVal = b.bookings
          break
        default:
          aVal = a.name
          bVal = b.name
      }
      const cmp =
        typeof aVal === 'number'
          ? aVal - (bVal as number)
          : (aVal as string).localeCompare(bVal as string)
      return sortOrder === 'asc' ? cmp : -cmp
    })

    const totalRecords = items.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    const pagedItems = items.slice((page - 1) * pageSize, page * pageSize).map(toListItem)

    const response: RestaurantListResponse = {
      items: pagedItems,
      pagination: { page, pageSize, totalRecords, totalPages },
    }
    return HttpResponse.json({ success: true, data: response })
  }),

  // GET /api/v1/restaurants/:id — full detail
  http.get(`${BASE}/:id`, ({ params }) => {
    const r = findReadableRestaurant(params.id)
    if (!r) {
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_RESTAURANT_NOT_FOUND' } },
        { status: 404 },
      )
    }
    return HttpResponse.json({ success: true, data: toDetail(r) })
  }),

  // GET /api/v1/restaurants/:id/contacts — CR-56. Name-ascending, no pagination.
  // Read-only: contacts are written by the partner (J6A), never by admin, so
  // there is deliberately no POST/PATCH/DELETE counterpart here.
  http.get(`${BASE}/:id/contacts`, ({ params }) => {
    const r = findReadableRestaurant(params.id)
    if (!r) return notFound()
    const response: RestaurantContactsResponse = {
      items: r.contacts.map(toContact).sort((a, b) => a.name.localeCompare(b.name)),
    }
    return HttpResponse.json({ success: true, data: response })
  }),

  // GET /api/v1/restaurants/:id/tables
  http.get(`${BASE}/:id/tables`, ({ params }) => {
    const r = findReadableRestaurant(params.id)
    if (!r) {
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_RESTAURANT_NOT_FOUND' } },
        { status: 404 },
      )
    }
    const response: RestaurantTablesResponse = {
      items: r.tables.map((t) => ({
        id: t.id,
        name: t.name,
        availability: t.slots.flatMap((s) =>
          s.ranges.map((range) => ({
            dayOfWeek: DAY_OF_WEEK[s.day] ?? 0,
            start: range.start,
            end: range.end,
          })),
        ),
      })),
    }
    return HttpResponse.json({ success: true, data: response })
  }),

  // GET /api/v1/restaurants/:id/menu-options
  http.get(`${BASE}/:id/menu-options`, ({ params }) => {
    const r = findReadableRestaurant(params.id)
    if (!r) {
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_RESTAURANT_NOT_FOUND' } },
        { status: 404 },
      )
    }
    const response: MenuOptionsResponse = {
      items: r.combos.map((c) => ({
        id: c.id,
        name: c.name,
        pricePkr: c.price,
        courses: c.courses,
      })),
    }
    return HttpResponse.json({ success: true, data: response })
  }),

  // GET /api/v1/restaurants/:id/amenities (CR-025) — assigned amenities, name-sorted
  http.get(`${BASE}/:id/amenities`, ({ params }) => {
    const r = findReadableRestaurant(params.id)
    if (!r) {
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_RESTAURANT_NOT_FOUND' } },
        { status: 404 },
      )
    }
    const assignedIds = (r as { amenityIds?: string[] }).amenityIds ?? []
    const items = mockAmenities
      .filter((a) => assignedIds.includes(a.id))
      .map((a) => ({ id: a.id, name: a.name, iconUrl: a.iconUrl }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return HttpResponse.json({ success: true, data: { items } })
  }),

  // PATCH /api/v1/restaurants/:id/category
  http.patch(`${BASE}/:id/category`, async ({ params, request }) => {
    const id = params.id as string
    const body = (await request.json()) as { categoryId: string }
    const idx = mockRestaurants.findIndex((x) => x.id === id)
    if (idx < 0) {
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_RESTAURANT_NOT_FOUND' } },
        { status: 404 },
      )
    }
    const cat = mockCategories.find((c) => c.id === body.categoryId)
    if (!cat) {
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_CATEGORY_NOT_FOUND' } },
        { status: 404 },
      )
    }
    mockRestaurants[idx] = { ...mockRestaurants[idx], categoryId: cat.id, category: cat.name }
    const result: ChangeCategoryResult = {
      id,
      category: { id: cat.id, name: cat.name },
    }
    return HttpResponse.json({ success: true, data: result })
  }),

  // GET /api/v1/restaurants/:id/media?kind=DOCUMENT|PHOTO|VIDEO
  http.get(`${BASE}/:id/media`, ({ params, request }) => {
    const r = findReadableRestaurant(params.id)
    if (!r) return notFound()
    const kind = new URL(request.url).searchParams.get('kind') ?? 'PHOTO'
    if (!['DOCUMENT', 'PHOTO', 'VIDEO'].includes(kind)) {
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_VALIDATION', message: 'Invalid media kind.' } },
        { status: 400 },
      )
    }
    const response: RestaurantMediaResponse = { items: buildMedia(kind) }
    return HttpResponse.json({ success: true, data: response })
  }),

  // GET /api/v1/restaurants/:id/bookings/count-active
  http.get(`${BASE}/:id/bookings/count-active`, ({ params }) => {
    const r = findReadableRestaurant(params.id)
    if (!r) return notFound()
    const data: ActiveBookingsCount = { count: r.bookings ?? 0 }
    return HttpResponse.json({ success: true, data })
  }),

  // POST /api/v1/restaurants/:id/suspend
  http.post(`${BASE}/:id/suspend`, async ({ params, request }) => {
    const idx = mockRestaurants.findIndex((x) => x.id === params.id)
    if (idx < 0) return notFound()
    const body = (await request.json()) as { reason?: string }
    if (!body.reason || body.reason.length < 10) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_VALIDATION',
            message: 'A reason of at least 10 characters is required.',
          },
        },
        { status: 400 },
      )
    }
    if (mockRestaurants[idx].status !== 'ACTIVE') {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'ERR_RESTAURANT_ALREADY_ACTIONED', message: 'Restaurant is not active.' },
        },
        { status: 409 },
      )
    }
    const bookingsCancelled = mockRestaurants[idx].bookings ?? 0
    mockRestaurants[idx] = { ...mockRestaurants[idx], status: 'SUSPENDED' }
    const data: SuspendResult = { id: params.id as string, status: 'SUSPENDED', bookingsCancelled }
    return HttpResponse.json({ success: true, data })
  }),

  // POST /api/v1/restaurants/:id/unsuspend
  http.post(`${BASE}/:id/unsuspend`, ({ params }) => {
    const idx = mockRestaurants.findIndex((x) => x.id === params.id)
    if (idx < 0) return notFound()
    if (mockRestaurants[idx].status !== 'SUSPENDED') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_RESTAURANT_ALREADY_ACTIONED',
            message: 'Restaurant is not suspended.',
          },
        },
        { status: 409 },
      )
    }
    mockRestaurants[idx] = { ...mockRestaurants[idx], status: 'ACTIVE' }
    const data: UnsuspendResult = { id: params.id as string, status: 'ACTIVE' }
    return HttpResponse.json({ success: true, data })
  }),
]
