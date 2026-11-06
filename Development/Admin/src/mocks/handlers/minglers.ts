import { http, HttpResponse } from 'msw'
import { mockMinglers, mockMinglerBookings, mockPaymentMethods } from '../data/index'

const BASE = '/api/v1/minglers'

type MockMingler = (typeof mockMinglers)[number]

function envelope<T>(data: T) {
  return { success: true as const, data }
}

function errorEnvelope(code: string, message: string, status: number, details: unknown = {}) {
  return HttpResponse.json({ success: false, error: { code, message, details } }, { status })
}

// Mock `mockMinglers` items derive isPromingler from `points`; this override
// map lets the PATCH .../promingler mock persist a toggle within a session.
const prominglerOverrides = new Map<string, boolean>()

function resolveIsPromingler(m: MockMingler): boolean {
  return prominglerOverrides.get(m.id) ?? m.points > 1500
}

function toMinglerListItem(m: MockMingler) {
  return {
    id: m.id,
    fullName: m.name,
    avatarUrl: null,
    avatarColor: m.color,
    initials: m.initials,
    phone: m.phone,
    email: m.email,
    joinedAt: m.joined,
    totalBookings: m.bookings,
    loyaltyPoints: m.points,
    status: m.status as 'ACTIVE' | 'SUSPENDED',
    isPromingler: resolveIsPromingler(m),
  }
}

function toMinglerDetail(m: MockMingler) {
  const identity = m.identity
  const childrenNum = identity?.children ? parseInt(identity.children, 10) : NaN
  return {
    id: m.id,
    fullName: m.name,
    avatarUrl: null,
    avatarColor: m.color,
    initials: m.initials,
    email: m.email,
    phone: m.phone,
    status: m.status as 'ACTIVE' | 'SUSPENDED',
    isPromingler: resolveIsPromingler(m),
    suspendedAt: null,
    joinedAt: m.joined,
    totalBookings: m.bookings,
    loyaltyPoints: m.points,
    about: identity
      ? {
          birthdate: identity.birthdate,
          energyDrive: identity.energyDrive,
          relationshipStatus: identity.relationshipStatus,
          children: Number.isNaN(childrenNum) ? undefined : childrenNum,
          professionIndustry: identity.professionIndustry,
          profession: identity.profession,
          personalInterests: identity.personalInterests?.join(', '),
          footballTeam: identity.footballTeam,
          pets: identity.pets,
          budget: identity.budget,
          enneagramType: identity.enneagramType,
        }
      : undefined,
  }
}

const SORT_GETTERS: Record<string, (m: MockMingler) => string | number> = {
  name: (m) => m.name,
  phone: (m) => m.phone,
  email: (m) => m.email,
  joined_at: (m) => m.joined,
  bookings: (m) => m.bookings,
  loyalty_points: (m) => m.points,
  status: (m) => m.status,
}

const ACTIVE_BOOKING_STATUSES = new Set(['PENDING', 'CONFIRMED'])

function countActiveBookings(): number {
  return mockMinglerBookings.filter((b) => ACTIVE_BOOKING_STATUSES.has(b.status.toUpperCase()))
    .length
}

// ── Eating preferences — a dynamic Q&A catalogue (mirrors the J6 Preference
// Questions module); reuses a couple of real question texts for realism.
const EATING_PREFERENCES_FIXTURE = [
  {
    questionId: 'pq1',
    question: 'How often do you eat out?',
    type: 'SINGLE_SELECT' as const,
    selectedOptions: [{ id: 'pq1-opt2', text: '4-6 times a month' }],
  },
  {
    questionId: 'pq2',
    question: 'What are your favourite cuisines?',
    type: 'MULTI_SELECT' as const,
    selectedOptions: [
      { id: 'pq2-opt1', text: 'Italian' },
      { id: 'pq2-opt2', text: 'Lebanese' },
    ],
  },
  {
    questionId: 'pq5',
    question: 'Do you have any dietary requirements?',
    type: 'MULTI_SELECT' as const,
    selectedOptions: [],
  },
  {
    questionId: 'pq7',
    question: 'Are you open to group dining?',
    type: 'SINGLE_SELECT' as const,
    selectedOptions: [{ id: 'pq7-opt1', text: 'Yes' }],
  },
]

// ── Payment methods — mutable in-memory store so set-default persists. ──
function parseExpiry(expiry: string): { expiryMonth: number; expiryYear: number } {
  const [mm, yy] = expiry.split('/')
  return { expiryMonth: Number(mm), expiryYear: 2000 + Number(yy) }
}

const paymentMethodsStore = mockPaymentMethods.map((pm) => {
  const cardType: 'CREDIT' | 'DEBIT' = pm.type.toLowerCase().includes('debit') ? 'DEBIT' : 'CREDIT'
  return {
    paymentMethodId: pm.id,
    brand: pm.network.toUpperCase(),
    last4: pm.last4,
    ...parseExpiry(pm.expiry),
    isDefault: pm.isDefault,
    cardType,
  }
})

export const minglersHandlers = [
  // GET /api/v1/minglers — paginated directory (search/sort/filter)
  http.get(BASE, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('pageSize') ?? 25)
    const sortBy = url.searchParams.get('sortBy') ?? 'joined_at'
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'
    const name = (url.searchParams.get('name') ?? '').trim().slice(0, 100)
    const phone = (url.searchParams.get('phone') ?? '').trim().slice(0, 100)
    const email = (url.searchParams.get('email') ?? '').trim().slice(0, 100)
    const joinedFrom = url.searchParams.get('joinedFrom')
    const joinedTo = url.searchParams.get('joinedTo')
    const statuses = url.searchParams.getAll('statuses')

    let items = [...mockMinglers]

    if (name) items = items.filter((m) => m.name.toLowerCase().includes(name.toLowerCase()))
    if (phone) items = items.filter((m) => m.phone.toLowerCase().includes(phone.toLowerCase()))
    if (email) items = items.filter((m) => m.email.toLowerCase().includes(email.toLowerCase()))
    if (joinedFrom) items = items.filter((m) => m.joined >= joinedFrom)
    if (joinedTo) items = items.filter((m) => m.joined <= joinedTo)
    if (statuses.length) items = items.filter((m) => statuses.includes(m.status))

    const sortGetter = SORT_GETTERS[sortBy] ?? SORT_GETTERS.joined_at
    items = [...items].sort((a, b) => {
      const [va, vb] = [sortGetter(a), sortGetter(b)]
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortOrder === 'asc' ? cmp : -cmp
    })

    const totalItems = items.length
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const start = (page - 1) * pageSize

    return HttpResponse.json(
      envelope({
        items: items.slice(start, start + pageSize).map(toMinglerListItem),
        pagination: { page, pageSize, totalItems, totalPages },
      }),
    )
  }),

  // GET /api/v1/minglers/prominglers/active — active Pro Minglers lookup for
  // the interest-table Promingler select. Registered before `:id` (distinct
  // 2-segment path, so no collision, but kept explicit).
  http.get(`${BASE}/prominglers/active`, () => {
    const items = mockMinglers
      .filter((m) => resolveIsPromingler(m))
      .map((m) => ({ id: m.id, fullName: m.name, phone: m.phone, email: m.email }))
    return HttpResponse.json(envelope({ items }))
  }),

  // GET /api/v1/minglers/:id — full detail record
  http.get(`${BASE}/:id`, ({ params }) => {
    const m = mockMinglers.find((x) => x.id === params.id)
    return m
      ? HttpResponse.json(envelope(toMinglerDetail(m)))
      : HttpResponse.json({ message: 'Not found' }, { status: 404 })
  }),

  http.get(`${BASE}/:id/bookings`, () => HttpResponse.json(mockMinglerBookings)),

  // GET /api/v1/minglers/:id/bookings/count-active — Suspend modal warning
  http.get(`${BASE}/:id/bookings/count-active`, ({ params }) => {
    const m = mockMinglers.find((x) => x.id === params.id)
    if (!m) return errorEnvelope('ERR_MINGLER_NOT_FOUND', 'Mingler not found.', 404)
    return HttpResponse.json(envelope({ count: countActiveBookings() }))
  }),

  // POST /api/v1/minglers/:id/suspend
  http.post(`${BASE}/:id/suspend`, async ({ params, request }) => {
    const m = mockMinglers.find((x) => x.id === params.id)
    if (!m) return errorEnvelope('ERR_MINGLER_NOT_FOUND', 'Mingler not found.', 404)
    if (m.status !== 'ACTIVE') {
      return errorEnvelope(
        'ERR_MINGLER_ALREADY_ACTIONED',
        'This Mingler has already been actioned by another admin.',
        409,
        { currentStatus: m.status },
      )
    }
    const body = (await request.json()) as { reason: string }
    const bookingsCancelled = countActiveBookings()
    m.status = 'SUSPENDED'
    return HttpResponse.json(
      envelope({
        id: m.id,
        status: 'SUSPENDED' as const,
        suspendedAt: new Date().toISOString(),
        suspendedReason: body.reason,
        bookingsCancelled,
      }),
    )
  }),

  // POST /api/v1/minglers/:id/reactivate
  http.post(`${BASE}/:id/reactivate`, ({ params }) => {
    const m = mockMinglers.find((x) => x.id === params.id)
    if (!m) return errorEnvelope('ERR_MINGLER_NOT_FOUND', 'Mingler not found.', 404)
    if (m.status !== 'SUSPENDED') {
      return errorEnvelope(
        'ERR_MINGLER_ALREADY_ACTIONED',
        'This Mingler has already been actioned by another admin.',
        409,
        { currentStatus: m.status },
      )
    }
    m.status = 'ACTIVE'
    return HttpResponse.json(
      envelope({ id: m.id, status: 'ACTIVE' as const, reactivatedAt: new Date().toISOString() }),
    )
  }),

  // PATCH /api/v1/minglers/:id/promingler
  http.patch(`${BASE}/:id/promingler`, async ({ params, request }) => {
    const m = mockMinglers.find((x) => x.id === params.id)
    if (!m) return errorEnvelope('ERR_MINGLER_NOT_FOUND', 'Mingler not found.', 404)
    const body = (await request.json()) as { isPromingler: boolean }
    prominglerOverrides.set(m.id, body.isPromingler)
    return HttpResponse.json(envelope({ id: m.id, isPromingler: body.isPromingler }))
  }),

  // GET /api/v1/minglers/:id/eating-preferences
  http.get(`${BASE}/:id/eating-preferences`, ({ params }) => {
    const m = mockMinglers.find((x) => x.id === params.id)
    if (!m) return errorEnvelope('ERR_MINGLER_NOT_FOUND', 'Mingler not found.', 404)
    return HttpResponse.json(envelope({ items: EATING_PREFERENCES_FIXTURE }))
  }),

  // GET /api/v1/minglers/:id/payment-methods
  http.get(`${BASE}/:id/payment-methods`, ({ params }) => {
    const m = mockMinglers.find((x) => x.id === params.id)
    if (!m) return errorEnvelope('ERR_MINGLER_NOT_FOUND', 'Mingler not found.', 404)
    return HttpResponse.json(envelope({ items: paymentMethodsStore }))
  }),

  // POST /api/v1/minglers/:id/payment-methods/:pmId/set-default
  http.post(`${BASE}/:id/payment-methods/:pmId/set-default`, ({ params }) => {
    const target = paymentMethodsStore.find((pm) => pm.paymentMethodId === params.pmId)
    if (!target) {
      return errorEnvelope('ERR_PAYMENT_METHOD_NOT_FOUND', 'Payment method not found.', 404)
    }
    paymentMethodsStore.forEach((pm) => {
      pm.isDefault = pm.paymentMethodId === target.paymentMethodId
    })
    return HttpResponse.json(envelope({ paymentMethodId: target.paymentMethodId, isDefault: true }))
  }),
]
