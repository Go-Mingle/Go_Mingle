import { HttpResponse } from 'msw'
import { errorResponse, mockProfile } from './partnerRestaurantProfile'
import type {
  ReviewDetail,
  ReviewListItem,
  ReviewRating,
  ReviewsPage,
} from '../../app/modules/restaurants/partnerReviews/types'

/**
 * J6G review fixtures — the ratings summary, the list, and the detail.
 *
 * Mirrors the real endpoint's awkward edges rather than the happy path, because
 * those are the branches worth catching in a test:
 *
 *  - `summary` is computed over **every** review and does not move when a filter is
 *    applied, so `summary.total` (8) and `pagination.totalRecords` diverge — the
 *    single most likely thing for a client to get wrong.
 *  - the list **never 422s**: a bad sort, page, or rating is clamped or ignored.
 *  - `mingler.name`, `interestTable.name`, `interestTable.topic` and `text` are each
 *    null on at least one row (a deleted Mingler, a retired topic, a rating-only
 *    review), so a client that assumes strings crashes here rather than in production.
 *  - `photoThumbnails` is `[]` on all but one row, matching the current reality that
 *    the review-photos bucket is unconfigured; the one populated row keeps the
 *    gallery path covered.
 *  - the detail's date is `DD MMM YYYY` while the list's is `DD-MM-YYYY`, on purpose.
 *
 * The seed reproduces the backend's own example: 8 reviews averaging 4.0 with a
 * `{5:3, 4:3, 3:1, 2:1, 1:0}` distribution.
 */

const PHOTO = 'https://cdn.mock.local/reviews/mezze-platter.jpg'

/**
 * A fixture row. `sortDate` is bookkeeping the API never returns: the wire `date` is
 * `DD-MM-YYYY`, which does not sort lexically, so an ISO key stands in for the
 * server's real column. `detailDate` holds the modal's differently-formatted string
 * so the two formats cannot accidentally converge.
 */
interface MockReview extends ReviewListItem {
  sortDate: string
  detailDate: string
}

function seed(): MockReview[] {
  return [
    {
      reviewId: 'r-1',
      date: '15-04-2026',
      sortDate: '2026-04-15',
      detailDate: '15 Apr 2026',
      mingler: { minglerId: 'm-1', name: 'Sana Khan' },
      interestTable: { name: 'Friday Wine Evening', topic: 'Wine & Dine' },
      rating: 5,
      text: 'Flawless Mediterranean dining. The mezze platter and grilled branzino were exceptional.',
      // The one row with photos, so the gallery is covered even though production
      // returns none until the bucket is configured.
      photoThumbnails: [PHOTO],
      bookingId: 'b-1',
    },
    {
      reviewId: 'r-2',
      date: '14-04-2026',
      sortDate: '2026-04-14',
      detailDate: '14 Apr 2026',
      mingler: { minglerId: 'm-2', name: 'Osama Hashmi' },
      interestTable: { name: "Chef's Tasting Night", topic: "Chef's Table" },
      rating: 5,
      text: 'Attentive service and a genuinely surprising menu. Booked again the same week.',
      photoThumbnails: [],
      bookingId: 'b-2',
    },
    {
      reviewId: 'r-3',
      date: '12-04-2026',
      sortDate: '2026-04-12',
      detailDate: '12 Apr 2026',
      // A deleted Mingler: the review survives, the name does not. The id still
      // resolves, and J6F's endpoint answers "Profile unavailable" for it.
      mingler: { minglerId: 'm-3', name: null },
      interestTable: { name: 'Friday Wine Evening', topic: 'Wine & Dine' },
      rating: 5,
      text: 'Lovely evening, great company.',
      photoThumbnails: [],
      bookingId: 'b-3',
    },
    {
      reviewId: 'r-4',
      date: '10-04-2026',
      sortDate: '2026-04-10',
      detailDate: '10 Apr 2026',
      mingler: { minglerId: 'm-4', name: 'Ayesha Noor Siddiqui' },
      // A retired topic.
      interestTable: { name: 'Rooftop Social', topic: null },
      rating: 4,
      text: 'Food was very good. The rooftop got a little loud once it filled up.',
      photoThumbnails: [],
      bookingId: 'b-4',
    },
    {
      reviewId: 'r-5',
      date: '08-04-2026',
      sortDate: '2026-04-08',
      detailDate: '08 Apr 2026',
      mingler: { minglerId: 'm-5', name: 'Yasmeen Iqbal' },
      interestTable: { name: 'Weekend Brunch Club', topic: 'Brunch' },
      rating: 4,
      // A rating with no words at all — allowed, and it must not render as "null".
      text: null,
      photoThumbnails: [],
      bookingId: 'b-5',
    },
    {
      reviewId: 'r-6',
      date: '05-04-2026',
      sortDate: '2026-04-05',
      detailDate: '05 Apr 2026',
      mingler: { minglerId: 'm-6', name: 'Bilal Ahmed' },
      interestTable: { name: 'Weekend Brunch Club', topic: 'Brunch' },
      rating: 4,
      text: 'Solid brunch, friendly staff, would recommend to anyone new to the city.',
      photoThumbnails: [],
      bookingId: 'b-6',
    },
    {
      reviewId: 'r-7',
      date: '02-04-2026',
      sortDate: '2026-04-02',
      detailDate: '02 Apr 2026',
      mingler: { minglerId: 'm-7', name: 'Hina Raza' },
      // A since-removed interest table leaves both fields null.
      interestTable: { name: null, topic: null },
      rating: 3,
      text: 'Reasonable but the kitchen was slow on a busy night.',
      photoThumbnails: [],
      bookingId: 'b-7',
    },
    {
      reviewId: 'r-8',
      date: '28-03-2026',
      sortDate: '2026-03-28',
      detailDate: '28 Mar 2026',
      mingler: { minglerId: 'm-8', name: 'Zain Malik' },
      interestTable: { name: "Chef's Tasting Night", topic: "Chef's Table" },
      rating: 2,
      text: 'The table was double-booked and we waited forty minutes to be seated.',
      photoThumbnails: [],
      bookingId: 'b-8',
    },
  ]
}

let reviews: MockReview[] = seed()

export function resetMockReviews(): void {
  reviews = seed()
}

/** Empties the tab, for the BR-09 empty state. */
export function clearMockReviews(): void {
  reviews = []
}

/**
 * What the restaurant on the token can actually see — and pre-approval that is nothing
 * (MET-1261).
 *
 * The Reviews tab is now offered in every profile state, because BR-11 says a read-only
 * profile still shows reviews. That makes the fixture's status matter: a review only
 * exists once a Mingler has *completed* an interest table, which a restaurant that has
 * never been live cannot have done. Serving the eight seeded rows to a Draft restaurant
 * would put "4.0 · 8 reviews" on a profile that has never taken a booking.
 *
 * It also restores the only reachable home for the BR-09 empty state
 * (TC-PARTNER-REVIEWS-012): switch the demo fixture to DRAFT, PENDING or REJECTED and
 * the tab renders "No reviews yet" — no `clearMockReviews()` call required, which is a
 * lever only the unit tests have.
 */
function visibleReviews(): MockReview[] {
  return mockProfile.status === 'ACTIVE' ? reviews : []
}

/** Strips the fixture-only sort/detail bookkeeping the API never returns. */
function toListItem({ sortDate, detailDate, ...item }: MockReview): ReviewListItem {
  void sortDate
  void detailDate
  return item
}

// ── The list read ──────────────────────────────────────────────
export interface ReviewsQuery {
  search?: string | null
  ratingFilter?: string[]
  sortBy?: string | null
  sortOrder?: string | null
  page?: string | null
  pageSize?: string | null
}

/**
 * Search matches the review text **and** the reviewer's name, case-insensitively —
 * one box over two fields, which is why there is no `searchField` param. A null
 * name or null text simply never matches.
 */
function matchesSearch(review: MockReview, needle: string): boolean {
  const term = needle.toLowerCase()
  return (
    (review.text?.toLowerCase().includes(term) ?? false) ||
    (review.mingler.name?.toLowerCase().includes(term) ?? false)
  )
}

/**
 * Direction is applied inside the comparator rather than by reversing the sorted
 * array, so the date tiebreak stays part of the ordering instead of flipping with it.
 */
function compareReviews(
  a: MockReview,
  b: MockReview,
  field: 'date' | 'rating',
  descending: boolean,
): number {
  const primary = field === 'rating' ? a.rating - b.rating : a.sortDate.localeCompare(b.sortDate)
  if (primary !== 0) return descending ? -primary : primary
  // A stable secondary key keeps paging deterministic when ratings tie.
  return a.reviewId.localeCompare(b.reviewId)
}

/**
 * Only 10, 25 and 50 are accepted, and the default is **10** — not the 25 the spec's
 * example showed. Anything else is clamped rather than rejected.
 */
function clampPageSize(raw: string | null | undefined): number {
  const parsed = Number(raw)
  return [10, 25, 50].includes(parsed) ? parsed : 10
}

function clampPage(raw: string | null | undefined, totalPages: number): number {
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1) return 1
  return Math.min(parsed, totalPages)
}

/**
 * The ratings summary, over **every** review — deliberately computed before any
 * filter is applied (BR-03). This is what makes `summary.total` and
 * `pagination.totalRecords` legitimately different numbers.
 */
function summarise(all: MockReview[]): ReviewsPage['summary'] {
  const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
  all.forEach((review) => {
    distribution[String(review.rating) as keyof typeof distribution] += 1
  })

  const total = all.length
  const sum = all.reduce((running, review) => running + review.rating, 0)
  // One decimal, matching the server; 32/8 → 4, not 4.000000001.
  const average = total > 0 ? Math.round((sum / total) * 10) / 10 : 0

  return { average, total, distribution }
}

/**
 * Mirrors the endpoint's forgiving behaviour: a bad sort, page, page size or rating
 * is clamped or ignored and the list still renders. This endpoint **never** returns
 * a 422, so there is deliberately no validation branch here.
 */
export function listMockReviews(query: ReviewsQuery): Response {
  const all = visibleReviews()
  const summary = summarise(all)
  let rows = [...all]

  const search = query.search?.trim()
  if (search) rows = rows.filter((review) => matchesSearch(review, search))

  const wanted = new Set(
    (query.ratingFilter ?? [])
      .map((value) => Number(value))
      .filter((value): value is ReviewRating => [1, 2, 3, 4, 5].includes(value)),
  )
  if (wanted.size > 0) rows = rows.filter((review) => wanted.has(review.rating))

  // An unrecognised sortBy falls back to the default rather than erroring.
  const field = query.sortBy === 'rating' ? 'rating' : 'date'
  const descending = query.sortOrder !== 'asc'
  rows.sort((a, b) => compareReviews(a, b, field, descending))

  const pageSize = clampPageSize(query.pageSize)
  const totalRecords = rows.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const page = clampPage(query.page, totalPages)
  const start = (page - 1) * pageSize

  const body: ReviewsPage = {
    summary,
    items: rows.slice(start, start + pageSize).map(toListItem),
    pagination: { page, pageSize, totalRecords, totalPages },
  }
  return HttpResponse.json({ success: true, data: body })
}

// ── The detail read ────────────────────────────────────────────
/**
 * One review in full.
 *
 * A 404 covers an unknown id, another restaurant's review, and one an admin has
 * deleted — indistinguishable by design, all meaning "this review is gone". A
 * pre-approval restaurant has none to read, so every id 404s there for the same reason.
 *
 * Note the deliberate differences from the list row: `date` is `DD MMM YYYY`, and
 * the photo field is named `photos`. Both are the real contract.
 */
export function mockReviewDetail(reviewId: string): Response {
  const review = visibleReviews().find((item) => item.reviewId === reviewId)
  if (!review) return errorResponse('ERR_NOT_FOUND', 'Review not found.', 404)

  const detail: ReviewDetail = {
    reviewId: review.reviewId,
    mingler: review.mingler,
    interestTable: review.interestTable,
    rating: review.rating,
    date: review.detailDate,
    text: review.text,
    // Identical URLs to the row's `photoThumbnails` — there is no thumbnail
    // derivative on the platform.
    photos: review.photoThumbnails,
    bookingId: review.bookingId,
  }
  return HttpResponse.json({ success: true, data: detail })
}

/** Removes one review, standing in for an admin soft-delete (BR-10). */
export function deleteMockReviewAsAdmin(reviewId: string): void {
  reviews = reviews.filter((item) => item.reviewId !== reviewId)
}
