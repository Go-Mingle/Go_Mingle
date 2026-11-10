import { http, HttpResponse } from 'msw'
import type {
  PreferenceQuestionOption,
  CreatePreferenceQuestionInput,
  UpdatePreferenceQuestionInput,
} from '../../app/modules/preference-questions/types'
import { mockPreferenceQuestions } from '../data/index'

const BASE = '/api/v1/preference-questions'

// Options fixture keyed by question ID — used for GET /:id and GET /active.
// A separate mutable record so POST/PATCH can add/update without touching the list store.
const mockPreferenceQuestionOptionsById: Record<string, PreferenceQuestionOption[]> = {
  pq1: [
    { id: 'pq1-opt1', text: 'Rarely', displayOrder: 0 },
    { id: 'pq1-opt2', text: '1–2 times a month', displayOrder: 1 },
    { id: 'pq1-opt3', text: 'Weekly', displayOrder: 2 },
    { id: 'pq1-opt4', text: '2–3 times a week', displayOrder: 3 },
    { id: 'pq1-opt5', text: 'Almost every day', displayOrder: 4 },
  ],
  pq2: [
    { id: 'pq2-opt1', text: 'Italian', displayOrder: 0 },
    { id: 'pq2-opt2', text: 'Indian', displayOrder: 1 },
    { id: 'pq2-opt3', text: 'Japanese', displayOrder: 2 },
    { id: 'pq2-opt4', text: 'Mediterranean', displayOrder: 3 },
    { id: 'pq2-opt5', text: 'American', displayOrder: 4 },
    { id: 'pq2-opt6', text: 'Chinese', displayOrder: 5 },
    { id: 'pq2-opt7', text: 'Mexican', displayOrder: 6 },
    { id: 'pq2-opt8', text: 'Arabic', displayOrder: 7 },
  ],
  pq3: [
    { id: 'pq3-opt1', text: 'Lunch', displayOrder: 0 },
    { id: 'pq3-opt2', text: 'Dinner', displayOrder: 1 },
    { id: 'pq3-opt3', text: 'Brunch', displayOrder: 2 },
    { id: 'pq3-opt4', text: 'Late night', displayOrder: 3 },
  ],
  pq4: [
    { id: 'pq4-opt1', text: 'Cosy & intimate', displayOrder: 0 },
    { id: 'pq4-opt2', text: 'Lively & social', displayOrder: 1 },
    { id: 'pq4-opt3', text: 'Quiet & romantic', displayOrder: 2 },
    { id: 'pq4-opt4', text: 'Outdoor terrace', displayOrder: 3 },
    { id: 'pq4-opt5', text: 'Modern & trendy', displayOrder: 4 },
    { id: 'pq4-opt6', text: 'Traditional & classic', displayOrder: 5 },
  ],
  pq5: [
    { id: 'pq5-opt1', text: 'Vegetarian', displayOrder: 0 },
    { id: 'pq5-opt2', text: 'Vegan', displayOrder: 1 },
    { id: 'pq5-opt3', text: 'Gluten-free', displayOrder: 2 },
    { id: 'pq5-opt4', text: 'Halal', displayOrder: 3 },
    { id: 'pq5-opt5', text: 'Nut allergy', displayOrder: 4 },
    { id: 'pq5-opt6', text: 'No dietary requirements', displayOrder: 5 },
  ],
  pq6: [
    { id: 'pq6-opt1', text: 'Under PKR 100', displayOrder: 0 },
    { id: 'pq6-opt2', text: 'PKR 100–200', displayOrder: 1 },
    { id: 'pq6-opt3', text: 'PKR 200–400', displayOrder: 2 },
    { id: 'pq6-opt4', text: 'PKR 400+', displayOrder: 3 },
  ],
  pq7: [
    { id: 'pq7-opt1', text: 'Yes, I love meeting new people', displayOrder: 0 },
    { id: 'pq7-opt2', text: 'Sometimes, depending on the occasion', displayOrder: 1 },
    { id: 'pq7-opt3', text: 'Prefer dining with people I know', displayOrder: 2 },
  ],
  pq8: [
    { id: 'pq8-opt1', text: 'Italian', displayOrder: 0 },
    { id: 'pq8-opt2', text: 'Japanese', displayOrder: 1 },
    { id: 'pq8-opt3', text: 'Other', displayOrder: 2 },
  ],
}

export const preferenceQuestionsHandlers = [
  // 1. List — paginated, sorted, filtered by q
  http.get(BASE, ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q') ?? ''
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
    const rawPageSize = Number(url.searchParams.get('pageSize') ?? '10')
    const pageSize = [10, 25, 50].includes(rawPageSize) ? rawPageSize : 10
    const sortBy = (url.searchParams.get('sortBy') ?? 'order') as 'order' | 'question'
    const sortOrder = (url.searchParams.get('sortOrder') ?? 'asc') as 'asc' | 'desc'

    let filtered = [...mockPreferenceQuestions]
    if (q) {
      filtered = filtered.filter((item) => item.question.toLowerCase().includes(q.toLowerCase()))
    }

    filtered.sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1
      if (sortBy === 'question') return a.question.localeCompare(b.question) * dir
      return (a.questionOrder - b.questionOrder) * dir
    })

    const totalRecords = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)

    return HttpResponse.json({
      success: true,
      data: {
        items,
        pagination: { page: safePage, pageSize, totalRecords, totalPages },
      },
    })
  }),

  // 2. Active — all questions with options (MUST be before /:id to avoid route conflict)
  http.get(`${BASE}/active`, () => {
    const items = mockPreferenceQuestions.map((pq) => ({
      ...pq,
      options: mockPreferenceQuestionOptionsById[pq.id] ?? [],
    }))
    return HttpResponse.json({ success: true, data: { items } })
  }),

  // 3. Create
  http.post(BASE, async ({ request }) => {
    const body = (await request.json()) as CreatePreferenceQuestionInput

    const duplicate = mockPreferenceQuestions.some(
      (pq) => pq.question.toLowerCase() === body.question.toLowerCase(),
    )
    if (duplicate) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_QUESTION_TEXT_IN_USE',
            message: 'A question with this text already exists.',
            details: {},
          },
        },
        { status: 409 },
      )
    }

    if (!body.options || body.options.length < 2) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_INSUFFICIENT_OPTIONS',
            message: 'At least two options are required.',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    // Auto-shift: push existing items at or above the new order up by 1
    mockPreferenceQuestions.forEach((pq) => {
      if (pq.questionOrder >= body.questionOrder) {
        pq.questionOrder += 1
      }
    })

    const newId = `pq${Date.now()}`
    const now = new Date().toISOString()

    mockPreferenceQuestions.push({
      id: newId,
      question: body.question,
      type: body.type,
      questionOrder: body.questionOrder,
      optionsCount: body.options.length,
      createdAt: now,
    })

    mockPreferenceQuestionOptionsById[newId] = body.options.map((opt, idx) => ({
      id: `${newId}-opt${idx + 1}`,
      text: opt.text,
      displayOrder: idx,
    }))

    return HttpResponse.json(
      {
        success: true,
        data: {
          id: newId,
          question: body.question,
          type: body.type,
          questionOrder: body.questionOrder,
          optionsCount: body.options.length,
          createdAt: now,
          updatedAt: null,
        },
      },
      { status: 201 },
    )
  }),

  // 4. Get by ID — full detail with options
  http.get(`${BASE}/:id`, ({ params }) => {
    const id = params.id as string
    const found = mockPreferenceQuestions.find((pq) => pq.id === id)
    if (!found) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_QUESTION_NOT_FOUND',
            message: 'Question not found.',
            details: {},
          },
        },
        { status: 404 },
      )
    }

    return HttpResponse.json({
      success: true,
      data: {
        id: found.id,
        question: found.question,
        type: found.type,
        questionOrder: found.questionOrder,
        options: mockPreferenceQuestionOptionsById[id] ?? [],
        createdAt: found.createdAt,
        updatedAt: null,
      },
    })
  }),

  // 5. Update
  http.patch(`${BASE}/:id`, async ({ params, request }) => {
    const id = params.id as string
    const idx = mockPreferenceQuestions.findIndex((pq) => pq.id === id)
    if (idx < 0) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_QUESTION_NOT_FOUND',
            message: 'Question not found.',
            details: {},
          },
        },
        { status: 404 },
      )
    }

    const body = (await request.json()) as UpdatePreferenceQuestionInput
    const current = mockPreferenceQuestions[idx]

    if (body.question !== undefined) {
      const duplicate = mockPreferenceQuestions.some(
        (pq, i) => i !== idx && pq.question.toLowerCase() === body.question!.toLowerCase(),
      )
      if (duplicate) {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_QUESTION_TEXT_IN_USE',
              message: 'A question with this text already exists.',
              details: {},
            },
          },
          { status: 409 },
        )
      }
    }

    if (body.options !== undefined && body.options.length < 2) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_INSUFFICIENT_OPTIONS',
            message: 'At least two options are required.',
            details: {},
          },
        },
        { status: 400 },
      )
    }

    if (body.questionOrder !== undefined && body.questionOrder !== current.questionOrder) {
      mockPreferenceQuestions.forEach((pq, i) => {
        if (i !== idx && pq.questionOrder >= body.questionOrder!) {
          pq.questionOrder += 1
        }
      })
    }

    const updated = {
      ...current,
      question: body.question ?? current.question,
      type: body.type ?? current.type,
      questionOrder: body.questionOrder ?? current.questionOrder,
      optionsCount: body.options ? body.options.length : current.optionsCount,
    }
    mockPreferenceQuestions[idx] = updated

    if (body.options !== undefined) {
      const existingOpts = mockPreferenceQuestionOptionsById[id] ?? []
      mockPreferenceQuestionOptionsById[id] = body.options.map((opt, i) => {
        if (opt.id) {
          const match = existingOpts.find((o) => o.id === opt.id)
          return { id: opt.id, text: opt.text, displayOrder: match ? match.displayOrder : i }
        }
        return { id: `${id}-opt-new${i}`, text: opt.text, displayOrder: i }
      })
    }

    return HttpResponse.json({
      success: true,
      data: {
        id: updated.id,
        question: updated.question,
        type: updated.type,
        questionOrder: updated.questionOrder,
        optionsCount: updated.optionsCount,
        updatedAt: new Date().toISOString(),
      },
    })
  }),

  // 6. Delete — 204 No Content
  http.delete(`${BASE}/:id`, ({ params }) => {
    const id = params.id as string
    const idx = mockPreferenceQuestions.findIndex((pq) => pq.id === id)
    if (idx < 0) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_QUESTION_NOT_FOUND',
            message: 'Question not found.',
            details: {},
          },
        },
        { status: 404 },
      )
    }
    mockPreferenceQuestions.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),
]
