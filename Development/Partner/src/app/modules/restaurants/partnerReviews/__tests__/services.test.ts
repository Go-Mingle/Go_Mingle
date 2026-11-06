import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../mocks/server'
import {
  clearMockReviews,
  deleteMockReviewAsAdmin,
  resetMockReviews,
} from '../../../../../mocks/data/partnerReviews'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../mocks/data/partnerRestaurantProfile'
import { HttpError } from '../../../../../shared/api/httpClient'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { PARTNER_REVIEWS_ENDPOINTS } from '../constants'
import { partnerReviewsService } from '../services'

beforeEach(() => {
  resetMockReviews()
  // The profile fixture now decides whether there are any reviews to serve at all
  // (MET-1261), and `setMockProfileStatus` is not in the global reset — so it is reset
  // here, or the pre-approval block below would empty every test after it.
  resetMockProfile()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

/** Captures the query string the service actually sent. */
function captureQuery() {
  const seen: string[] = []
  server.use(
    http.get(`*${PARTNER_REVIEWS_ENDPOINTS.reviews}`, ({ request }) => {
      seen.push(new URL(request.url).search)
      return HttpResponse.json({
        success: true,
        data: {
          summary: {
            average: 0,
            total: 0,
            distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
          },
          items: [],
          pagination: { page: 1, pageSize: 10, totalRecords: 0, totalPages: 1 },
        },
      })
    }),
  )
  return () => seen
}

describe('listReviews — the summary', () => {
  it('reports the average, total and full distribution', async () => {
    const { summary } = await partnerReviewsService.listReviews()

    expect(summary.average).toBe(4)
    expect(summary.total).toBe(8)
    expect(summary.distribution).toEqual({ '5': 3, '4': 3, '3': 1, '2': 1, '1': 0 })
  })

  /** All five keys are always present, so the histogram needs no missing-key guard. */
  it('includes every star key even when nobody gave that rating', async () => {
    const { summary } = await partnerReviewsService.listReviews()

    expect(Object.keys(summary.distribution).sort()).toEqual(['1', '2', '3', '4', '5'])
    expect(summary.distribution['1']).toBe(0)
  })

  /**
   * The headline count describes every review the restaurant ever received and must
   * not move when a filter narrows the rows. This is the divergence most likely to be
   * wired up wrongly, so it is asserted directly.
   */
  it('does not change when a rating filter is applied', async () => {
    const unfiltered = await partnerReviewsService.listReviews()
    const filtered = await partnerReviewsService.listReviews({ ratingFilter: [5] })

    expect(filtered.summary.total).toBe(8)
    expect(filtered.summary.total).toBe(unfiltered.summary.total)
    expect(filtered.summary.distribution).toEqual(unfiltered.summary.distribution)
    // …while the filtered count genuinely does change.
    expect(filtered.pagination.totalRecords).toBe(3)
  })

  it('reports a zero summary for a restaurant with no reviews', async () => {
    clearMockReviews()
    const { summary, items, pagination } = await partnerReviewsService.listReviews()

    expect(summary).toEqual({
      average: 0,
      total: 0,
      distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    })
    expect(items).toEqual([])
    expect(pagination.totalRecords).toBe(0)
  })
})

describe('listReviews — pagination', () => {
  /** Nested under `pagination`, matching the rest of the app rather than the spec example. */
  it('returns the nested pagination block', async () => {
    const { pagination } = await partnerReviewsService.listReviews()

    expect(pagination).toEqual({ page: 1, pageSize: 10, totalRecords: 8, totalPages: 1 })
  })

  it('defaults to a page size of 10, not 25', async () => {
    const { pagination } = await partnerReviewsService.listReviews()
    expect(pagination.pageSize).toBe(10)
  })

  it('slices server-side rather than returning everything', async () => {
    const first = await partnerReviewsService.listReviews({ page: 1, pageSize: 10 })
    expect(first.items).toHaveLength(8)

    const paged = await partnerReviewsService.listReviews({ pageSize: 10 })
    expect(paged.pagination.totalPages).toBe(1)
  })

  it.each([10, 25, 50])('accepts the page size %i', async (pageSize) => {
    const query = captureQuery()
    await partnerReviewsService.listReviews({ pageSize })

    expect(query()[0]).toContain(`pageSize=${String(pageSize)}`)
  })

  /** Sanitised away before it reaches the wire, so the control cannot lie. */
  it('never sends a page size the endpoint refuses', async () => {
    const query = captureQuery()
    await partnerReviewsService.listReviews({ pageSize: 100 as never })

    expect(query()[0]).not.toContain('pageSize')
  })
})

describe('listReviews — search', () => {
  it('matches the review text', async () => {
    const { items, pagination } = await partnerReviewsService.listReviews({ search: 'branzino' })

    expect(pagination.totalRecords).toBe(1)
    expect(items[0].reviewId).toBe('r-1')
  })

  /** One box over two fields — text and reviewer name — hence no `searchField` param. */
  it('matches the reviewer name too', async () => {
    const { items } = await partnerReviewsService.listReviews({ search: 'Osama' })

    expect(items).toHaveLength(1)
    expect(items[0].mingler.name).toBe('Osama Hashmi')
  })

  it('is case-insensitive', async () => {
    const upper = await partnerReviewsService.listReviews({ search: 'BRUNCH' })
    expect(upper.pagination.totalRecords).toBeGreaterThan(0)
  })

  it('returns nothing for a term that matches neither', async () => {
    const { items, pagination } = await partnerReviewsService.listReviews({ search: 'zzzz' })

    expect(items).toEqual([])
    expect(pagination.totalRecords).toBe(0)
    // The headline still describes all eight.
    expect(pagination.totalRecords).not.toBe(8)
  })

  it('does not crash on rows with a null name or null text', async () => {
    await expect(partnerReviewsService.listReviews({ search: 'lovely' })).resolves.toBeTruthy()
  })
})

describe('listReviews — the rating filter', () => {
  it('returns only the requested rating', async () => {
    const { items } = await partnerReviewsService.listReviews({ ratingFilter: [5] })

    expect(items).toHaveLength(3)
    expect(items.every((item) => item.rating === 5)).toBe(true)
  })

  it('accepts a subset of several ratings', async () => {
    const { items } = await partnerReviewsService.listReviews({ ratingFilter: [5, 4] })

    expect(items).toHaveLength(6)
    expect(items.every((item) => item.rating === 5 || item.rating === 4)).toBe(true)
  })

  it('returns nothing for a rating nobody gave', async () => {
    const { items } = await partnerReviewsService.listReviews({ ratingFilter: [1] })
    expect(items).toEqual([])
  })

  it('sends the filter as repeated keys', async () => {
    const query = captureQuery()
    await partnerReviewsService.listReviews({ ratingFilter: [5, 4] })

    expect(new URLSearchParams(query()[0]).getAll('ratingFilter')).toEqual(['5', '4'])
  })
})

describe('listReviews — sorting', () => {
  it('defaults to date descending, newest first', async () => {
    const { items } = await partnerReviewsService.listReviews()

    expect(items[0].date).toBe('15-04-2026')
    expect(items[items.length - 1].date).toBe('28-03-2026')
  })

  it('sorts date ascending on request', async () => {
    const { items } = await partnerReviewsService.listReviews({
      sortBy: 'date',
      sortOrder: 'asc',
    })

    expect(items[0].date).toBe('28-03-2026')
  })

  it('sorts by rating', async () => {
    const ascending = await partnerReviewsService.listReviews({
      sortBy: 'rating',
      sortOrder: 'asc',
    })
    const ratings = ascending.items.map((item) => item.rating)

    expect(ratings[0]).toBe(2)
    expect(ratings).toEqual([...ratings].sort((a, b) => a - b))
  })

  it('sorts by rating descending', async () => {
    const { items } = await partnerReviewsService.listReviews({
      sortBy: 'rating',
      sortOrder: 'desc',
    })

    expect(items[0].rating).toBe(5)
  })

  /**
   * The endpoint never 422s — it ignores a bad sort. Our sanitiser drops it first so
   * the header never claims an ordering the server did not apply.
   */
  it('drops an unknown sort field instead of sending it', async () => {
    const query = captureQuery()
    await partnerReviewsService.listReviews({ sortBy: 'mingler' as never })

    expect(query()[0]).not.toContain('sortBy')
  })
})

describe('listReviews — the row shape', () => {
  it('carries both the interest table name and topic', async () => {
    const { items } = await partnerReviewsService.listReviews({ search: 'branzino' })

    expect(items[0].interestTable).toEqual({
      name: 'Friday Wine Evening',
      topic: 'Wine & Dine',
    })
  })

  it('renders dates in the list format, unparsed', async () => {
    const { items } = await partnerReviewsService.listReviews()

    expect(items[0].date).toMatch(/^\d{2}-\d{2}-\d{4}$/)
  })

  it('always carries a bookingId, so the row icon needs no null branch', async () => {
    const { items } = await partnerReviewsService.listReviews()

    expect(items.every((item) => typeof item.bookingId === 'string' && item.bookingId)).toBe(true)
  })

  it('exposes the nullable fields as null rather than omitting them', async () => {
    const { items } = await partnerReviewsService.listReviews({ pageSize: 10 })

    const deletedMingler = items.find((item) => item.reviewId === 'r-3')
    const retiredTopic = items.find((item) => item.reviewId === 'r-4')
    const ratingOnly = items.find((item) => item.reviewId === 'r-5')
    const removedTable = items.find((item) => item.reviewId === 'r-7')

    expect(deletedMingler?.mingler.name).toBeNull()
    expect(deletedMingler?.mingler.minglerId).toBe('m-3')
    expect(retiredTopic?.interestTable.topic).toBeNull()
    expect(ratingOnly?.text).toBeNull()
    expect(removedTable?.interestTable).toEqual({ name: null, topic: null })
  })

  /** `[]` is the normal case until the review-photos bucket is configured. */
  it('reports an empty photo list as [] rather than omitting it', async () => {
    const { items } = await partnerReviewsService.listReviews()
    const withoutPhotos = items.find((item) => item.reviewId === 'r-2')

    expect(withoutPhotos?.photoThumbnails).toEqual([])
  })

  it('never leaks the fixture-only sort bookkeeping', async () => {
    const { items } = await partnerReviewsService.listReviews()

    expect(items[0]).not.toHaveProperty('sortDate')
    expect(items[0]).not.toHaveProperty('detailDate')
  })
})

describe('getReview', () => {
  it('returns the full review', async () => {
    const detail = await partnerReviewsService.getReview('r-1')

    expect(detail.reviewId).toBe('r-1')
    expect(detail.text).toContain('grilled branzino')
    expect(detail.rating).toBe(5)
  })

  /** The two endpoints format the same date differently, on purpose. */
  it('formats the date differently from the list row', async () => {
    const detail = await partnerReviewsService.getReview('r-1')
    const { items } = await partnerReviewsService.listReviews()

    expect(detail.date).toBe('15 Apr 2026')
    expect(items[0].date).toBe('15-04-2026')
    expect(detail.date).not.toBe(items[0].date)
  })

  /** Beyond what the spec's example showed, so the modal can offer the booking jump. */
  it('also carries the interest table and bookingId', async () => {
    const detail = await partnerReviewsService.getReview('r-1')

    expect(detail.interestTable.name).toBe('Friday Wine Evening')
    expect(detail.bookingId).toBe('b-1')
  })

  it('returns the same photo URLs the row called thumbnails', async () => {
    const detail = await partnerReviewsService.getReview('r-1')
    const { items } = await partnerReviewsService.listReviews()

    expect(detail.photos).toEqual(items[0].photoThumbnails)
  })

  it('carries a null text through to the modal', async () => {
    const detail = await partnerReviewsService.getReview('r-5')
    expect(detail.text).toBeNull()
  })

  it('404s for an unknown review', async () => {
    const error = (await partnerReviewsService
      .getReview('r-nope')
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(404)
    expect(error.code).toBe('ERR_NOT_FOUND')
  })

  /** BR-10 — an admin deletion is indistinguishable from an unknown id, by design. */
  it('404s for a review an admin has deleted', async () => {
    deleteMockReviewAsAdmin('r-1')
    const error = (await partnerReviewsService
      .getReview('r-1')
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(404)
  })

  it('drops the deleted review from the list and summary on the next read', async () => {
    deleteMockReviewAsAdmin('r-1')
    const { items, summary } = await partnerReviewsService.listReviews()

    expect(items.map((item) => item.reviewId)).not.toContain('r-1')
    expect(summary.total).toBe(7)
    expect(summary.distribution['5']).toBe(2)
  })
})

/**
 * MET-1261 — the tab is offered before approval, so the fixture has to be honest about
 * what a pre-approval restaurant holds: nothing.
 *
 * A review exists only once a Mingler has completed an interest table, which a
 * restaurant that has never been live cannot have done. This is also the only reachable
 * route to the BR-09 empty state now that the Active fixture is seeded — the state
 * TC-PARTNER-REVIEWS-012 covers.
 */
describe('a pre-approval restaurant', () => {
  it.each(['DRAFT', 'PENDING', 'REJECTED'] as const)(
    'holds no reviews at all while %s',
    async (status) => {
      setMockProfileStatus(status)
      const { items, summary, pagination } = await partnerReviewsService.listReviews()

      expect(items).toEqual([])
      expect(summary).toEqual({
        average: 0,
        total: 0,
        distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      })
      expect(pagination.totalRecords).toBe(0)
    },
  )

  /** The same 404 the other three causes produce — "this review is not yours to read". */
  it('404s the detail read for a review it cannot see', async () => {
    setMockProfileStatus('PENDING')
    const error = (await partnerReviewsService
      .getReview('r-1')
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(404)
    expect(error.code).toBe('ERR_NOT_FOUND')
  })

  it('serves the seeded reviews again once Active', async () => {
    setMockProfileStatus('PENDING')
    expect((await partnerReviewsService.listReviews()).items).toEqual([])

    setMockProfileStatus('ACTIVE')
    expect((await partnerReviewsService.listReviews()).summary.total).toBe(8)
  })
})

describe('the endpoints', () => {
  it('carry no restaurant id — scope comes from the token', () => {
    expect(PARTNER_REVIEWS_ENDPOINTS.reviews).toBe('/api/v1/partner/reviews')
    expect(PARTNER_REVIEWS_ENDPOINTS.reviewById('r-1')).toBe('/api/v1/partner/reviews/r-1')
  })

  it('surfaces the backend message on a server error', async () => {
    server.use(
      http.get(`*${PARTNER_REVIEWS_ENDPOINTS.reviews}`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL', message: 'Reviews unavailable.' } },
          { status: 500 },
        ),
      ),
    )

    const error = (await partnerReviewsService.listReviews().catch((e: unknown) => e)) as HttpError
    expect(error.code).toBe('ERR_INTERNAL')
  })
})
