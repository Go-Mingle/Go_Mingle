import { http, HttpResponse } from 'msw'
import { mockApplications } from '../data/index'

// Real approval-queue contract (spec J9): GET /api/v1/admin/approvals with a
// `status` filter (pending|rejected) + pagination whose `totalRecords` drives
// the sidebar badge. Excluded from browserHandlers so the app hits the real
// backend; this exists for the Node/Vitest environment only.
const BASE = '/api/v1/admin/approvals'

type MockApplication = (typeof mockApplications)[number]

function toApiItem(a: MockApplication) {
  const rec = a as unknown as Record<string, unknown>
  return {
    id: a.id,
    name: a.name,
    cuisine: a.cuisine,
    ownerName: a.owner,
    ownerPhone: a.phone,
    ownerEmail: a.email,
    city: a.city,
    submittedAt: a.submitted,
    avatarUrl: undefined as string | undefined,
    rejectedAt: rec.rejectedOn as string | undefined,
    latestReason: rec.rejectionReason as string | undefined,
  }
}

function notFound() {
  return HttpResponse.json(
    { success: false, error: { code: 'ERR_APPLICATION_NOT_FOUND', message: 'Not found' } },
    { status: 404 },
  )
}

export const approvalsHandlers = [
  // GET /api/v1/admin/approvals — status-filtered, paginated queue listing.
  http.get(BASE, ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') ?? 25))
    const restaurant = (url.searchParams.get('restaurant') ?? '').trim().toLowerCase()
    const owner = (url.searchParams.get('owner') ?? '').trim().toLowerCase()

    let items = [...mockApplications]
    if (status) {
      const want = status === 'rejected' ? 'REJECTED' : 'PENDING'
      items = items.filter((a) => a.status === want)
    }
    // Restaurant name and owner filters apply independently (AND).
    if (restaurant) {
      items = items.filter((a) => a.name.toLowerCase().includes(restaurant))
    }
    if (owner) {
      items = items.filter((a) => a.owner.toLowerCase().includes(owner))
    }

    const totalRecords = items.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    const start = (page - 1) * pageSize
    return HttpResponse.json({
      success: true,
      data: {
        items: items.slice(start, start + pageSize).map(toApiItem),
        pagination: { page, pageSize, totalRecords, totalPages },
      },
    })
  }),

  // GET /api/v1/admin/approvals/:id
  http.get(`${BASE}/:id`, ({ params }) => {
    const a = mockApplications.find((x) => x.id === params.id)
    if (!a) return notFound()
    return HttpResponse.json({
      success: true,
      data: { ...toApiItem(a), status: a.status, rejectionHistory: [] },
    })
  }),

  // POST /api/v1/admin/approvals/:id/approve
  http.post(`${BASE}/:id/approve`, ({ params }) =>
    HttpResponse.json({ success: true, data: { id: params.id, status: 'APPROVED' } }),
  ),

  // POST /api/v1/admin/approvals/:id/decline
  http.post(`${BASE}/:id/decline`, ({ params }) =>
    HttpResponse.json({ success: true, data: { id: params.id, status: 'REJECTED' } }),
  ),
]
