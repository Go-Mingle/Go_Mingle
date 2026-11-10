import { http, HttpResponse } from 'msw'
import type { Interest } from '../../app/modules/interests/types'
import { mockInterests } from '../data/index'

const BASE = '/api/v1/interests'

// The API accepts pageSize ∈ {25, 50, 100} (default 25) and page ≥ 1, silently
// falling back on anything else instead of returning 400 — mirrored here so the
// mock can't accept a size the real endpoint would reject. `sortBy`/`sortOrder`
// are deliberately not modelled: the Interests table sorts client-side, so
// nothing sends them and re-ordering the fixtures would only churn other
// suites' expectations.
const ALLOWED_PAGE_SIZES = [25, 50, 100]
const DEFAULT_PAGE_SIZE = 25

function readPageSize(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10)
  return ALLOWED_PAGE_SIZES.includes(n) ? n : DEFAULT_PAGE_SIZE
}

function readPage(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

export const interestsHandlers = [
  // GET /api/v1/interests — paginated list.
  http.get(BASE, ({ request }) => {
    const url = new URL(request.url)
    const page = readPage(url.searchParams.get('page'))
    const pageSize = readPageSize(url.searchParams.get('pageSize'))
    const totalRecords = mockInterests.length
    return HttpResponse.json({
      success: true,
      data: {
        items: mockInterests.slice((page - 1) * pageSize, page * pageSize),
        pagination: {
          page,
          pageSize,
          totalRecords,
          totalPages: Math.ceil(totalRecords / pageSize),
        },
      },
    })
  }),

  // GET /api/v1/interests/active — active interests. Sources the create form's
  // category dropdown AND the topic form's interests multi-select (MET-1304).
  // Declared before /:id so "active" isn't captured as an id param.
  http.get(`${BASE}/active`, () =>
    HttpResponse.json({
      success: true,
      data: {
        items: mockInterests.map((i) => ({ id: i.id, name: i.name, groupName: i.groupName })),
      },
    }),
  ),

  // GET /api/v1/interests/:id — single record (powers the edit modal).
  http.get(`${BASE}/:id`, ({ params }) => {
    const found = mockInterests.find((i) => i.id === params.id)
    if (!found) {
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_INTEREST_NOT_FOUND', message: 'Not found' } },
        { status: 404 },
      )
    }
    return HttpResponse.json({ success: true, data: found })
  }),

  // POST /api/v1/interests — create.
  http.post(BASE, async ({ request }) => {
    const body = (await request.json()) as { name: string; groupName: string }
    const exists = mockInterests.some((i) => i.name.toLowerCase() === body.name.toLowerCase())
    if (exists) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_INTEREST_NAME_IN_USE',
            message: 'Interest name already exists.',
            details: { name: body.name },
          },
        },
        { status: 409 },
      )
    }
    const created: Interest = {
      id: `i${Date.now()}`,
      name: body.name,
      groupName: body.groupName,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    }
    mockInterests.push(created)
    return HttpResponse.json({ success: true, data: created }, { status: 201 })
  }),

  // PATCH /api/v1/interests/:id — update.
  http.patch(`${BASE}/:id`, async ({ params, request }) => {
    const id = params.id as string
    const body = (await request.json()) as Partial<Pick<Interest, 'name' | 'groupName'>>
    const idx = mockInterests.findIndex((i) => i.id === id)
    if (idx < 0) {
      return HttpResponse.json(
        { success: false, error: { code: 'ERR_INTEREST_NOT_FOUND', message: 'Not found' } },
        { status: 404 },
      )
    }
    if (body.name) {
      const duplicate = mockInterests.some(
        (i, j) => j !== idx && i.name.toLowerCase() === (body.name as string).toLowerCase(),
      )
      if (duplicate) {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_INTEREST_NAME_IN_USE',
              message: 'Interest name already exists.',
              details: { name: body.name },
            },
          },
          { status: 409 },
        )
      }
    }
    mockInterests[idx] = {
      ...mockInterests[idx],
      ...body,
      updatedAt: new Date().toISOString(),
    }
    return HttpResponse.json({ success: true, data: mockInterests[idx] })
  }),

  // DELETE /api/v1/interests/:id
  http.delete(`${BASE}/:id`, ({ params }) => {
    const id = params.id as string
    const idx = mockInterests.findIndex((i) => i.id === id)
    if (idx >= 0) mockInterests.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),
]
