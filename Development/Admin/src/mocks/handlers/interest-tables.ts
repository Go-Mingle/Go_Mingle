import { http, HttpResponse } from 'msw'
import type {
  InterestTable,
  InterestTableMenuOptionItem,
  InterestTableSortField,
  CreateInterestTablePayload,
  UpdateInterestTablePayload,
  InviteeRow,
  MasterInterestTableItem,
} from '../../app/modules/interest-tables/types'
import { mockV1InterestTables, mockInterestTableMenuOptions, mockMinglers } from '../data/index'

const RESTAURANT_BASE = '/api/v1/restaurants'
const INTEREST_TABLE_BASE = '/api/v1/interest-tables'

function itNotFound() {
  return HttpResponse.json(
    { success: false, error: { code: 'ERR_INTEREST_TABLE_NOT_FOUND', message: 'Not found' } },
    { status: 404 },
  )
}

// Session-scoped invitee lists, keyed by interest-table id.
const inviteesByTable = new Map<string, InviteeRow[]>()

function seedInvitees(id: string): InviteeRow[] {
  if (!inviteesByTable.has(id)) {
    inviteesByTable.set(
      id,
      mockMinglers.slice(0, 3).map((m, i) => ({
        minglerId: m.id,
        fullName: m.name,
        avatarUrl: null,
        isPromingler: i === 0,
        dateInvited: new Date(2026, 5, 10 + i).toISOString(),
        status: i === 0 ? 'TABLE_BOOKED' : 'INVITED',
      })),
    )
  }
  return inviteesByTable.get(id)!
}

/** Test-only: reset session-scoped invitee state. */
export function __resetInviteesMock() {
  inviteesByTable.clear()
}

/**
 * Master-list projection of a mock interest table (CR-43). Deliberately mirrors
 * the real contract rather than the richer `InterestTable`: dates arrive
 * pre-formatted as strings, and `promingler` is a bare name or null (the API
 * does not send a mingler id yet — see the Promingler cell for how that lands).
 */
function toMasterListItem(t: InterestTable): MasterInterestTableItem {
  const [year, month, day] = (t.startDate ?? '').split('-')
  return {
    id: t.id,
    name: t.name,
    coverImageUrl: t.eventImageUrl ?? null,
    restaurant: t.restaurant ? { id: t.restaurant.id, name: t.restaurant.name } : null,
    startDate: year && month && day ? `${day}-${month}-${year}` : (t.startDate ?? ''),
    startTime: t.startTime ?? '',
    maxGuests: t.maxGuests ?? t.maxMinglers ?? 0,
    availabilityMode: t.availabilityMode ?? 'AVAILABLE_NOW',
    inviteOnly: Boolean(t.inviteOnly),
    promingler: t.prominglerEnabled ? (t.promingler?.fullName ?? t.promingler?.name ?? null) : null,
    status: t.status,
  }
}

/** Multi-select params accept repeated keys or CSV; normalise both to a flat list. */
function multiParam(url: URL, key: string): string[] {
  return url.searchParams
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
}

export const interestTablesV1Handlers = [
  // GET /api/v1/interest-tables — cross-restaurant master list (CR-43).
  http.get(INTEREST_TABLE_BASE, ({ request }) => {
    const url = new URL(request.url)

    const search = (url.searchParams.get('search') ?? '').trim()
    // The only param that can hard-fail; every other bad value is dropped.
    if (search.length > 100) {
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_VALIDATION', message: 'Search term too long.' } },
        { status: 400 },
      )
    }

    const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10)
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1
    const rawSize = parseInt(url.searchParams.get('pageSize') ?? '25', 10)
    const pageSize = ([10, 25, 50] as const).includes(rawSize as 10 | 25 | 50)
      ? (rawSize as 10 | 25 | 50)
      : 25

    const sortByParam = url.searchParams.get('sortBy') ?? ''
    const sortBy = (['interestTable', 'restaurant', 'dateTime', 'maxGuests'] as const).includes(
      sortByParam as InterestTableSortField,
    )
      ? (sortByParam as InterestTableSortField)
      : 'dateTime'
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

    const searchField = url.searchParams.get('searchField')
    const availabilityModes = multiParam(url, 'availabilityMode')
    const statuses = multiParam(url, 'status')
    const restaurantIds = multiParam(url, 'restaurantId')
    const inviteOnlyParam = url.searchParams.get('inviteOnly')

    let items = mockV1InterestTables.map(toMasterListItem)

    if (search) {
      const needle = search.toLowerCase()
      items = items.filter((item) => {
        const inName = item.name.toLowerCase().includes(needle)
        const inRestaurant = (item.restaurant?.name ?? '').toLowerCase().includes(needle)
        if (searchField === 'interestTable') return inName
        if (searchField === 'restaurant') return inRestaurant
        return inName || inRestaurant
      })
    }
    if (availabilityModes.length) {
      items = items.filter((item) => availabilityModes.includes(item.availabilityMode))
    }
    if (statuses.length) {
      items = items.filter((item) => statuses.includes(item.status))
    }
    if (restaurantIds.length) {
      items = items.filter((item) => item.restaurant && restaurantIds.includes(item.restaurant.id))
    }
    if (inviteOnlyParam === 'true' || inviteOnlyParam === 'false') {
      items = items.filter((item) => item.inviteOnly === (inviteOnlyParam === 'true'))
    }

    items = [...items].sort((a, b) => {
      let cmp: number
      switch (sortBy) {
        case 'interestTable':
          cmp = a.name.localeCompare(b.name)
          break
        case 'restaurant':
          cmp = (a.restaurant?.name ?? '').localeCompare(b.restaurant?.name ?? '')
          break
        case 'maxGuests':
          cmp = a.maxGuests - b.maxGuests
          break
        default:
          // startDate is DD-MM-YYYY — reorder to YYYY-MM-DD before comparing.
          cmp = `${a.startDate.split('-').reverse().join('-')} ${a.startTime}`.localeCompare(
            `${b.startDate.split('-').reverse().join('-')} ${b.startTime}`,
          )
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    const totalRecords = items.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))

    return HttpResponse.json({
      success: true,
      data: {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        pagination: { page, pageSize, totalRecords, totalPages },
      },
    })
  }),

  // GET /api/v1/restaurants/:rid/interest-tables
  http.get(`${RESTAURANT_BASE}/:rid/interest-tables`, ({ request, params }) => {
    const rid = params.rid as string
    const url = new URL(request.url)

    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
    const rawSize = parseInt(url.searchParams.get('pageSize') ?? '10', 10)
    const pageSize = ([10, 25, 50] as const).includes(rawSize as 10 | 25 | 50)
      ? (rawSize as 10 | 25 | 50)
      : 10
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const status = url.searchParams.get('status') ?? ''
    const sortBy = url.searchParams.get('sortBy') ?? 'created'
    const sortOrder = url.searchParams.get('sortOrder') === 'DESC' ? 'DESC' : 'ASC'

    let items: InterestTable[] = mockV1InterestTables.filter((t) => t.restaurant?.id === rid)

    if (q) {
      items = items.filter((t) => t.name.toLowerCase().includes(q))
    }

    if (status) {
      items = items.filter((t) => t.status === status)
    }

    items = [...items].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number
      switch (sortBy) {
        case 'name':
          aVal = a.name
          bVal = b.name
          break
        case 'status':
          aVal = a.status
          bVal = b.status
          break
        case 'seatsBooked':
          aVal = a.seatsBooked ?? 0
          bVal = b.seatsBooked ?? 0
          break
        default:
          aVal = a.created
          bVal = b.created
      }
      const cmp =
        typeof aVal === 'number'
          ? aVal - (bVal as number)
          : (aVal as string).localeCompare(bVal as string)
      return sortOrder === 'ASC' ? cmp : -cmp
    })

    const totalRecords = items.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    const pagedItems = items.slice((page - 1) * pageSize, page * pageSize)

    return HttpResponse.json({
      success: true,
      data: {
        items: pagedItems,
        pagination: { page, pageSize, totalRecords, totalPages },
      },
    })
  }),

  // POST /api/v1/restaurants/:rid/interest-tables
  http.post(`${RESTAURANT_BASE}/:rid/interest-tables`, async ({ request, params }) => {
    const rid = params.rid as string
    const body = (await request.json()) as CreateInterestTablePayload

    const restaurant = { id: rid, name: `Restaurant ${rid}` }

    // publish=false → DRAFT; publish=true → PENDING (Available Now) or COMING_SOON.
    const status: InterestTable['status'] = body.publish
      ? body.availabilityMode === 'COMING_SOON'
        ? 'COMING_SOON'
        : 'PENDING'
      : 'DRAFT'

    const created: InterestTable = {
      id: `it-v1-${Date.now()}`,
      name: body.name,
      topic: null,
      assignedTable: body.restaurantTableId
        ? { id: body.restaurantTableId, name: `Table ${body.restaurantTableId}` }
        : null,
      restaurant,
      seatsBooked: 0,
      minMinglers: 4,
      maxMinglers: body.maxGuests,
      maxGuests: body.maxGuests,
      minGuests: 4,
      startDate: body.startDate,
      startTime: body.startTime,
      durationHours: body.durationMinutes / 60,
      sponsorName: null,
      sponsorLogoUrl: null,
      eventImageUrl: null,
      availabilityMode: body.availabilityMode,
      inviteOnly: body.inviteOnly ?? false,
      prominglerEnabled: body.prominglerEnabled ?? false,
      prominglerMinglerId: body.prominglerMinglerId,
      timeLeft: `${Math.floor((new Date(`${body.startDate}T${body.startTime}`).getTime() - Date.now()) / 3_600_000)}h`,
      status,
      created: new Date().toISOString(),
    }

    mockV1InterestTables.unshift(created)

    return HttpResponse.json({ success: true, data: created }, { status: 201 })
  }),

  // GET /api/v1/interest-tables/:id
  http.get(`${INTEREST_TABLE_BASE}/:id`, ({ params }) => {
    const id = params.id as string
    const found = mockV1InterestTables.find((t) => t.id === id)
    if (!found) {
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_INTEREST_TABLE_NOT_FOUND', message: 'Not found' } },
        { status: 404 },
      )
    }
    return HttpResponse.json({ success: true, data: found })
  }),

  // PATCH /api/v1/interest-tables/:id — edit
  http.patch(`${INTEREST_TABLE_BASE}/:id`, async ({ params, request }) => {
    const id = params.id as string
    const idx = mockV1InterestTables.findIndex((t) => t.id === id)
    if (idx < 0) return itNotFound()
    const body = (await request.json()) as UpdateInterestTablePayload
    const existing = mockV1InterestTables[idx]
    mockV1InterestTables[idx] = {
      ...existing,
      ...(body.name !== undefined && { name: body.name }),
      ...(body.maxGuests !== undefined && {
        maxMinglers: body.maxGuests,
        maxGuests: body.maxGuests,
      }),
      ...(body.startDate !== undefined && { startDate: body.startDate }),
      ...(body.startTime !== undefined && { startTime: body.startTime }),
      ...(body.availabilityMode !== undefined && { availabilityMode: body.availabilityMode }),
      ...(body.inviteOnly !== undefined && { inviteOnly: body.inviteOnly }),
    }
    return HttpResponse.json({ success: true, data: mockV1InterestTables[idx] })
  }),

  // DELETE /api/v1/interest-tables/:id — soft delete
  http.delete(`${INTEREST_TABLE_BASE}/:id`, ({ params }) => {
    const id = params.id as string
    const idx = mockV1InterestTables.findIndex((t) => t.id === id)
    if (idx < 0) return itNotFound()
    mockV1InterestTables.splice(idx, 1)
    return HttpResponse.json({ success: true, data: { id, deleted: true } })
  }),

  // POST /api/v1/interest-tables/:id/make-available
  http.post(`${INTEREST_TABLE_BASE}/:id/make-available`, ({ params }) => {
    const id = params.id as string
    const idx = mockV1InterestTables.findIndex((t) => t.id === id)
    if (idx < 0) return itNotFound()
    mockV1InterestTables[idx] = {
      ...mockV1InterestTables[idx],
      availabilityMode: 'AVAILABLE_NOW',
      status: 'PENDING',
    }
    return HttpResponse.json({
      success: true,
      data: { id, status: mockV1InterestTables[idx].status, availability: 'AVAILABLE_NOW' },
    })
  }),

  // POST /api/v1/interest-tables/:id/publish — DRAFT → PENDING / COMING_SOON
  http.post(`${INTEREST_TABLE_BASE}/:id/publish`, ({ params }) => {
    const id = params.id as string
    const idx = mockV1InterestTables.findIndex((t) => t.id === id)
    if (idx < 0) return itNotFound()
    const existing = mockV1InterestTables[idx]
    const status = existing.availabilityMode === 'COMING_SOON' ? 'COMING_SOON' : 'PENDING'
    mockV1InterestTables[idx] = { ...existing, status }
    return HttpResponse.json({ success: true, data: mockV1InterestTables[idx] })
  }),

  // POST /api/v1/interest-tables/:id/cancel — admin cancel (refund cascade server-side)
  http.post(`${INTEREST_TABLE_BASE}/:id/cancel`, ({ params }) => {
    const id = params.id as string
    const idx = mockV1InterestTables.findIndex((t) => t.id === id)
    if (idx < 0) return itNotFound()
    mockV1InterestTables[idx] = { ...mockV1InterestTables[idx], status: 'CANCELLED' }
    return HttpResponse.json({
      success: true,
      data: { id, status: 'CANCELLED', cancelledCount: mockV1InterestTables[idx].seatsBooked },
    })
  }),

  // POST /api/v1/interest-tables/:id/promingler — Change Promingler
  http.post(`${INTEREST_TABLE_BASE}/:id/promingler`, async ({ params, request }) => {
    const id = params.id as string
    const idx = mockV1InterestTables.findIndex((t) => t.id === id)
    if (idx < 0) return itNotFound()
    const body = (await request.json()) as { prominglerMinglerId?: string }
    if (!body.prominglerMinglerId) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'ERR_VALIDATION', message: 'prominglerMinglerId is required' },
        },
        { status: 400 },
      )
    }
    mockV1InterestTables[idx] = {
      ...mockV1InterestTables[idx],
      prominglerEnabled: true,
      prominglerMinglerId: body.prominglerMinglerId,
    }
    return HttpResponse.json({ success: true, data: mockV1InterestTables[idx] })
  }),

  // GET /api/v1/interest-tables/:id/invitees
  http.get(`${INTEREST_TABLE_BASE}/:id/invitees`, ({ params, request }) => {
    const id = params.id as string
    if (!mockV1InterestTables.some((t) => t.id === id)) return itNotFound()
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
    const pageSize = parseInt(url.searchParams.get('pageSize') ?? '10', 10)
    const status = url.searchParams.get('status') ?? ''
    const q = (url.searchParams.get('q') ?? '').toLowerCase()

    let items = [...seedInvitees(id)]
    if (status) items = items.filter((i) => i.status === status)
    if (q) items = items.filter((i) => (i.fullName ?? '').toLowerCase().includes(q))

    const totalRecords = items.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    return HttpResponse.json({
      success: true,
      data: {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        pagination: { page, pageSize, totalRecords, totalPages },
      },
    })
  }),

  // POST /api/v1/interest-tables/:id/invitees
  http.post(`${INTEREST_TABLE_BASE}/:id/invitees`, async ({ params, request }) => {
    const id = params.id as string
    if (!mockV1InterestTables.some((t) => t.id === id)) return itNotFound()
    const { minglerId } = (await request.json()) as { minglerId: string }
    const mingler = mockMinglers.find((m) => m.id === minglerId)
    if (!mingler) {
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_MINGLER_NOT_FOUND', message: 'Mingler not found.' } },
        { status: 404 },
      )
    }
    const list = seedInvitees(id)
    const existing = list.find((i) => i.minglerId === minglerId)
    if (existing) return HttpResponse.json({ success: true, data: existing }, { status: 200 })
    const invitee: InviteeRow = {
      minglerId,
      fullName: mingler.name,
      avatarUrl: null,
      isPromingler: false,
      dateInvited: new Date(2026, 6, 1).toISOString(),
      status: 'INVITED',
    }
    list.push(invitee)
    return HttpResponse.json({ success: true, data: invitee }, { status: 201 })
  }),

  // DELETE /api/v1/interest-tables/:id/invitees/:minglerId
  http.delete(`${INTEREST_TABLE_BASE}/:id/invitees/:minglerId`, ({ params }) => {
    const id = params.id as string
    const minglerId = params.minglerId as string
    if (!mockV1InterestTables.some((t) => t.id === id)) return itNotFound()
    const list = seedInvitees(id)
    const idx = list.findIndex((i) => i.minglerId === minglerId)
    if (idx >= 0) list.splice(idx, 1)
    return HttpResponse.json({ success: true, data: { minglerId, removed: idx >= 0 } })
  }),

  // GET /api/v1/restaurants/:rid/lookups/interest-tables
  http.get(`${RESTAURANT_BASE}/:rid/lookups/interest-tables`, ({ params }) => {
    const rid = params.rid as string
    const items = mockV1InterestTables
      .filter((t) => t.restaurant?.id === rid)
      .map((t) => ({ interestTableId: t.id, interestTableName: t.name }))
      .sort((a, b) => a.interestTableName.localeCompare(b.interestTableName))
    return HttpResponse.json({ success: true, data: { items } })
  }),

  // GET /api/v1/interest-tables/:id/menu-options
  http.get(`${INTEREST_TABLE_BASE}/:id/menu-options`, ({ params }) => {
    const id = params.id as string
    const found = mockV1InterestTables.find((t) => t.id === id)
    if (!found) {
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_INTEREST_TABLE_NOT_FOUND', message: 'Not found' } },
        { status: 404 },
      )
    }
    const items: InterestTableMenuOptionItem[] = mockInterestTableMenuOptions
    return HttpResponse.json({ success: true, data: { items } })
  }),

  // GET /api/v1/restaurants/:rid/tables/:tid/availability-check
  http.get(`${RESTAURANT_BASE}/:rid/tables/:tid/availability-check`, ({ params }) => {
    const tid = params.tid as string
    // Fixture: table-2 is always booked for this slot so UI can show the conflict state
    if (tid === 'table-2') {
      return HttpResponse.json({
        success: true,
        data: { assignable: false, reason: 'Table already booked for this slot' },
      })
    }
    return HttpResponse.json({
      success: true,
      data: { assignable: true, reason: null },
    })
  }),
]
