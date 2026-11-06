import { http, HttpResponse } from 'msw'
import { mockReviews, mockMinglers } from '../data/index'

const V1 = '/api/v1'

function envelope<T>(data: T) {
  return { success: true as const, data }
}

function errorEnvelope(code: string, message: string, status: number, details: unknown = {}) {
  return HttpResponse.json({ success: false, error: { code, message, details } }, { status })
}

// Soft-deletes persist for the session so the list reflects the removal and a
// repeat delete/detail-read of the same id returns 404 (idempotent contract).
const deletedReviewIds = new Set<string>()

/** Test-only: clear soft-delete state so cases don't leak into one another. */
export function __resetReviewsMock() {
  deletedReviewIds.clear()
}

// The real reviews API returns dates as "DD-MM-YYYY"; mockReviews stores ISO
// "YYYY-MM-DD", so convert to mirror the production contract.
function toApiDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}-${month}-${year}`
}

function buildSummary(source: typeof mockReviews) {
  const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
  source.forEach((r) => {
    distribution[String(r.rating)] = (distribution[String(r.rating)] ?? 0) + 1
  })
  const total = source.length
  const average = total ? source.reduce((sum, r) => sum + r.rating, 0) / total : 0
  const positive = source.filter((r) => r.rating >= 4).length
  const neutral = source.filter((r) => r.rating === 3).length
  const negative = source.filter((r) => r.rating <= 2).length
  return {
    average: Math.round(average * 10) / 10,
    total,
    distribution,
    positive,
    neutral,
    negative,
  }
}

export const reviewsHandlers = [
  // GET /api/v1/restaurants/:rid/reviews — restaurant-scoped list + summary (spec J10D / CR-021)
  http.get(`${V1}/restaurants/:rid/reviews`, ({ params, request }) => {
    const rid = params.rid as string
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const ratingFilter = url.searchParams
      .getAll('ratingFilter')
      .flatMap((v) => v.split(','))
      .map(Number)
      .filter((n) => n >= 1 && n <= 5)
    const interestTableId = url.searchParams.get('interestTableId') ?? ''
    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('pageSize') ?? 10)
    const sortBy = url.searchParams.get('sortBy') ?? 'date'
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

    let source = mockReviews.filter((r) => !deletedReviewIds.has(r.id))
    const summary = buildSummary(source)

    if (q) source = source.filter((r) => r.text.toLowerCase().includes(q))
    if (ratingFilter.length > 0) source = source.filter((r) => ratingFilter.includes(r.rating))
    // interestTableId filter is best-effort against the mock fixture.
    if (interestTableId) source = source.filter((_, i) => i % 2 === 0)

    source = [...source].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'rating') cmp = a.rating - b.rating
      else if (a.date < b.date) cmp = -1
      else if (a.date > b.date) cmp = 1
      return sortOrder === 'asc' ? cmp : -cmp
    })

    const items = source.map((r) => ({
      id: r.id,
      date: toApiDate(r.date),
      minglerId: 'm-mock',
      minglerName: mockMinglers[0]?.name ?? 'Mingler',
      rating: r.rating,
      bodyPreview: r.text,
      photoUrls: r.photos ?? [],
      bookingId: r.bookingId ?? 'BK-MOCK',
      interestTableId: 'it-mock',
      interestTableName: 'Sunday Brunch Club',
      restaurantId: rid,
      menuOption: 'Two-Course Set Menu',
    }))

    const totalRecords = items.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    const start = (page - 1) * pageSize

    return HttpResponse.json(
      envelope({
        summary,
        items: items.slice(start, start + pageSize),
        pagination: { page, pageSize, totalRecords, totalPages },
      }),
    )
  }),

  // GET /api/v1/admin/reviews?minglerId=&q=&ratingFilter=&page=&pageSize=&sortBy=&sortOrder=
  http.get(`${V1}/admin/reviews`, ({ request }) => {
    const url = new URL(request.url)
    const minglerId = url.searchParams.get('minglerId') ?? ''
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const ratingFilter = (url.searchParams.get('ratingFilter') ?? '')
      .split(',')
      .map(Number)
      .filter((n) => n >= 1 && n <= 5)
    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('pageSize') ?? 10)
    const sortBy = url.searchParams.get('sortBy') === 'rating' ? 'rating' : 'date'
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

    const mingler = mockMinglers.find((m) => m.id === minglerId)
    const minglerName = mingler?.name ?? 'Unknown Mingler'

    // Filter + sort on the ISO source dates so ordering stays chronological.
    let source = mockReviews.filter((r) => !deletedReviewIds.has(r.id))
    if (q) source = source.filter((r) => r.text.toLowerCase().includes(q))
    if (ratingFilter.length > 0) source = source.filter((r) => ratingFilter.includes(r.rating))

    const compareByDate = (a: { date: string }, b: { date: string }) => {
      if (a.date < b.date) return -1
      if (a.date > b.date) return 1
      return 0
    }
    source = [...source].sort((a, b) => {
      const cmp = sortBy === 'rating' ? a.rating - b.rating : compareByDate(a, b)
      return sortOrder === 'asc' ? cmp : -cmp
    })

    const items = source.map((r) => ({
      id: r.id,
      date: toApiDate(r.date),
      minglerId,
      minglerName,
      rating: r.rating,
      bodyPreview: r.text,
      photoUrls: r.photos ?? [],
      bookingId: r.bookingId ?? null,
      interestTableId: 'it-mock',
      interestTableName: 'Sunday Brunch Club',
      restaurantId: 'rest-mock',
      menuOption: 'Two-Course Set Menu',
    }))

    const totalRecords = items.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    const start = (page - 1) * pageSize

    return HttpResponse.json(
      envelope({
        items: items.slice(start, start + pageSize),
        pagination: { page, pageSize, totalRecords, totalPages },
      }),
    )
  }),

  // GET /api/v1/reviews/:id — read-only detail
  http.get(`${V1}/reviews/:id`, ({ params }) => {
    const id = params.id as string
    const r = mockReviews.find((x) => x.id === id)
    if (!r || deletedReviewIds.has(id)) {
      return errorEnvelope('ERR_REVIEW_NOT_FOUND', 'Review not found.', 404)
    }
    return HttpResponse.json(
      envelope({
        id: r.id,
        restaurantName: r.restaurant,
        minglerName: mockMinglers[0]?.name ?? 'Mingler',
        rating: r.rating,
        body: r.text,
        photoUrls: r.photos ?? [],
        date: toApiDate(r.date),
        bookingId: r.bookingId ?? null,
        interestTableId: 'it-mock',
        interestTableName: 'Sunday Brunch Club',
        restaurantId: 'rest-mock',
        menuOption: 'Two-Course Set Menu',
        questionAnswers: [{ key: 'food', label: 'How was the food?', answer: r.rating }],
      }),
    )
  }),

  // DELETE /api/v1/reviews/:id — soft-delete → 204
  http.delete(`${V1}/reviews/:id`, ({ params }) => {
    const id = params.id as string
    const exists = mockReviews.some((x) => x.id === id)
    if (!exists || deletedReviewIds.has(id)) {
      return errorEnvelope('ERR_REVIEW_NOT_FOUND', 'Review not found.', 404)
    }
    deletedReviewIds.add(id)
    return new HttpResponse(null, { status: 204 })
  }),
]
