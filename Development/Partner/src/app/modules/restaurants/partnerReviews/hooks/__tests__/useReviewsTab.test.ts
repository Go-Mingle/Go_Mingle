import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../../mocks/server'
import { clearMockReviews, resetMockReviews } from '../../../../../../mocks/data/partnerReviews'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { HttpError } from '../../../../../../shared/api/httpClient'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import type { ProfileFeedback } from '../../../partnerProfile/hooks/useProfileFeedback'
import { PARTNER_REVIEWS_ENDPOINTS } from '../../constants'
import { useReviewsTab } from '../useReviewsTab'

function makeFeedback(): ProfileFeedback {
  return { showSuccess: vi.fn(), showError: vi.fn(), showErrorText: vi.fn() }
}

function renderTab(feedback: ProfileFeedback = makeFeedback()) {
  const queryClient = makeQueryClient()
  return {
    feedback,
    ...renderHook(() => useReviewsTab(feedback), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(AllProviders, { queryClient, children }),
    }),
  }
}

async function renderLoaded(feedback?: ProfileFeedback) {
  const view = renderTab(feedback)
  await waitFor(() => {
    expect(view.result.current.isPending).toBe(false)
  })
  return view
}

/** Records the query string of every list read, to prove the work is server-side. */
function trackQueries() {
  const seen: string[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname === PARTNER_REVIEWS_ENDPOINTS.reviews) seen.push(url.search)
  })
  return () => seen
}

beforeEach(() => {
  resetMockReviews()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('useReviewsTab — states', () => {
  it('starts pending, then loads', async () => {
    const { result } = renderTab()
    expect(result.current.isPending).toBe(true)

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })
    expect(result.current.items).toHaveLength(8)
  })

  it('defaults to page 1, ten per page, date descending', async () => {
    const { result } = await renderLoaded()

    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(10)
    expect(result.current.sortBy).toBe('date')
    expect(result.current.sortOrder).toBe('desc')
    expect(result.current.items[0].date).toBe('15-04-2026')
  })

  it('reports an empty restaurant (BR-09)', async () => {
    clearMockReviews()
    const { result } = await renderLoaded()

    expect(result.current.isEmpty).toBe(true)
    expect(result.current.hasFilters).toBe(false)
    expect(result.current.items).toEqual([])
  })

  it('surfaces a load failure to the caller rather than toasting it', async () => {
    server.use(
      http.get(`*${PARTNER_REVIEWS_ENDPOINTS.reviews}`, () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    )
    const feedback = makeFeedback()
    const { result } = renderTab(feedback)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as HttpError).status).toBe(500)
    // A failed read is an inline Alert, not a toast (the house convention).
    expect(feedback.showErrorText).not.toHaveBeenCalled()
    // A failed read is not an empty restaurant.
    expect(result.current.isEmpty).toBe(false)
  })
})

describe('useReviewsTab — the two counts', () => {
  /**
   * The single most likely thing to be wired up wrongly: the headline count is
   * all-time and must not follow the filtered row count.
   */
  it('keeps the all-time summary separate from the filtered total', async () => {
    const { result } = await renderLoaded()

    expect(result.current.summary?.total).toBe(8)
    expect(result.current.total).toBe(8)

    act(() => {
      result.current.applyRatingFilter(['5'])
    })
    await waitFor(() => {
      expect(result.current.total).toBe(3)
    })

    // The headline and histogram still describe all eight.
    expect(result.current.summary?.total).toBe(8)
    expect(result.current.summary?.distribution).toEqual({
      '5': 3,
      '4': 3,
      '3': 1,
      '2': 1,
      '1': 0,
    })
  })

  it('exposes the average and full distribution', async () => {
    const { result } = await renderLoaded()

    expect(result.current.summary?.average).toBe(4)
    expect(Object.keys(result.current.summary?.distribution ?? {})).toHaveLength(5)
  })
})

describe('useReviewsTab — server-side paging', () => {
  it('sends the page rather than slicing locally', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.changePage(2)
    })

    await waitFor(() => {
      expect(queries().some((query) => query.includes('page=2'))).toBe(true)
    })
    server.events.removeAllListeners()
  })

  it('sends the page size and returns to page 1', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.changePage(2)
    })
    act(() => {
      result.current.changePageSize(25)
    })

    await waitFor(() => {
      expect(queries().some((query) => query.includes('pageSize=25'))).toBe(true)
    })
    // A larger page is a different slice, so staying on page 2 could land on nothing.
    expect(result.current.page).toBe(1)
    server.events.removeAllListeners()
  })

  it('never sends a page size the endpoint refuses', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.changePageSize(100)
    })

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false)
    })
    expect(queries().some((query) => query.includes('pageSize=100'))).toBe(false)
    server.events.removeAllListeners()
  })
})

describe('useReviewsTab — server-side search, filter and sort', () => {
  it('sends the search term to the server', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.applySearch('branzino')
    })

    await waitFor(() => {
      expect(queries().some((query) => query.includes('search=branzino'))).toBe(true)
    })
    await waitFor(() => {
      expect(result.current.items).toHaveLength(1)
    })
    server.events.removeAllListeners()
  })

  it('sends the rating filter as repeated keys', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.applyRatingFilter(['5', '4'])
    })

    await waitFor(() => {
      const match = queries().find((query) => query.includes('ratingFilter'))
      expect(new URLSearchParams(match).getAll('ratingFilter')).toEqual(['5', '4'])
    })
    server.events.removeAllListeners()
  })

  it('keeps the rating filter as state the column can reflect', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.applyRatingFilter(['5', '3'])
    })
    expect(result.current.ratingFilter).toEqual([5, 3])

    act(() => {
      result.current.applyRatingFilter(null)
    })
    expect(result.current.ratingFilter).toEqual([])
  })

  it('sends the sort field and order', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.applySort('rating', 'asc')
    })

    await waitFor(() => {
      expect(
        queries().some(
          (query) => query.includes('sortBy=rating') && query.includes('sortOrder=asc'),
        ),
      ).toBe(true)
    })
    // Waited on the data, not the request: `placeholderData` deliberately keeps the
    // previous rows on screen until the re-sorted page arrives, so asserting straight
    // after the request would still see the old order.
    await waitFor(() => {
      expect(result.current.items[0].rating).toBe(2)
    })
    server.events.removeAllListeners()
  })

  it.each([
    ['a search', (c: { applySearch: (v: string) => void }) => c.applySearch('brunch')],
    [
      'a rating filter',
      (c: { applyRatingFilter: (v: unknown) => void }) => c.applyRatingFilter(['4']),
    ],
    [
      'a sort change',
      (c: { applySort: (f: 'rating', o: 'asc') => void }) => c.applySort('rating', 'asc'),
    ],
  ])('returns to page 1 after %s', async (_label, apply) => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.changePage(2)
    })
    expect(result.current.page).toBe(2)

    act(() => {
      apply(result.current as never)
    })
    expect(result.current.page).toBe(1)
  })

  it('reports that filters are narrowing the list', async () => {
    const { result } = await renderLoaded()
    expect(result.current.hasFilters).toBe(false)

    act(() => {
      result.current.applySearch('zzzz')
    })
    await waitFor(() => {
      expect(result.current.items).toEqual([])
    })

    // Not an empty restaurant — filters found nothing, which needs different copy.
    expect(result.current.hasFilters).toBe(true)
    expect(result.current.isEmpty).toBe(false)
  })
})

describe('useReviewsTab — the review details modal', () => {
  it('fetches nothing until a row is opened', async () => {
    const { result } = await renderLoaded()

    expect(result.current.openReviewId).toBeNull()
    expect(result.current.reviewDetail).toBeUndefined()
  })

  it('loads the full review on open', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openReview('r-1')
    })
    await waitFor(() => {
      expect(result.current.reviewDetail?.reviewId).toBe('r-1')
    })
    expect(result.current.reviewDetail?.date).toBe('15 Apr 2026')
  })

  it('closes on request', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openReview('r-1')
    })
    act(() => {
      result.current.closeReview()
    })
    expect(result.current.openReviewId).toBeNull()
  })

  /**
   * The 404 path the backend asked for: treat it as "this review is gone", tell the
   * partner once, and refresh the list rather than showing an error panel.
   */
  it('closes the modal, toasts, and refreshes the list when the review is gone', async () => {
    const feedback = makeFeedback()
    const { result } = await renderLoaded(feedback)
    const queries = trackQueries()

    act(() => {
      result.current.openReview('r-nope')
    })

    await waitFor(() => {
      expect(feedback.showErrorText).toHaveBeenCalledTimes(1)
    })
    // The modal is closed, so there is no region left for an inline alert.
    expect(result.current.openReviewId).toBeNull()
    expect(result.current.reviewDetailError).toBe(false)
    // And the stale row is re-read away.
    await waitFor(() => {
      expect(queries().length).toBeGreaterThan(0)
    })
    server.events.removeAllListeners()
  })

  it('reports a non-404 detail failure for an in-modal alert instead', async () => {
    server.use(
      http.get(`*${PARTNER_REVIEWS_ENDPOINTS.reviewById(':reviewId')}`, () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    )
    const feedback = makeFeedback()
    const { result } = await renderLoaded(feedback)

    act(() => {
      result.current.openReview('r-1')
    })

    await waitFor(() => {
      expect(result.current.reviewDetailError).toBe(true)
    })
    // Still open, so the alert has somewhere to live — and no toast.
    expect(result.current.openReviewId).toBe('r-1')
    expect(feedback.showErrorText).not.toHaveBeenCalled()
  })
})

describe('useReviewsTab — the two J6F modals', () => {
  it('opens and closes the Mingler profile by id', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openMingler('m-1')
    })
    expect(result.current.openMinglerId).toBe('m-1')

    act(() => {
      result.current.closeMingler()
    })
    expect(result.current.openMinglerId).toBeNull()
  })

  it('opens and closes the booking details by id', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openBooking('b-1')
    })
    expect(result.current.openBookingId).toBe('b-1')

    act(() => {
      result.current.closeBooking()
    })
    expect(result.current.openBookingId).toBeNull()
  })

  /** BR-02 — nothing on this controller can write. */
  it('exposes no mutation of any kind', async () => {
    const { result } = await renderLoaded()
    const keys = Object.keys(result.current)

    expect(keys.filter((key) => /delete|remove|reply|flag|hide|moderat/i.test(key))).toEqual([])
  })
})
