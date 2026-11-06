import { describe, it, expect, beforeEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../../mocks/server'
import { resetMockReviews } from '../../../../../../mocks/data/partnerReviews'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { HttpError } from '../../../../../../shared/api/httpClient'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import { PARTNER_REVIEWS_ENDPOINTS, PARTNER_REVIEWS_QUERY_KEY } from '../../constants'
import { useReviewDetailQuery, useReviewsQuery } from '../usePartnerReviewsQueries'
import type { ReviewsParams } from '../../types'

function wrapperFor(queryClient = makeQueryClient()) {
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  }
}

function renderList(params: ReviewsParams = {}) {
  const { queryClient, wrapper } = wrapperFor()
  return { ...renderHook(() => useReviewsQuery(params), { wrapper }), queryClient }
}

beforeEach(() => {
  resetMockReviews()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('useReviewsQuery', () => {
  it('loads the summary, items and pagination', async () => {
    const { result } = renderList()

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.summary.total).toBe(8)
    expect(result.current.data?.items).toHaveLength(8)
    expect(result.current.data?.pagination.totalRecords).toBe(8)
  })

  /** No session, no request — the tab renders its loading state and the guard redirects. */
  it('does not fire without a session', () => {
    tokenStore.clear()
    const { result } = renderList()

    expect(result.current.fetchStatus).toBe('idle')
  })

  it('keys the cache by params so paging does not clobber the previous page', async () => {
    const { queryClient, wrapper } = wrapperFor()
    const { result } = renderHook(() => useReviewsQuery({ page: 2 }), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(queryClient.getQueryData([...PARTNER_REVIEWS_QUERY_KEY, { page: 2 }])).toBeDefined()
    expect(queryClient.getQueryData([...PARTNER_REVIEWS_QUERY_KEY, { page: 1 }])).toBeUndefined()
  })

  it('caches a filtered view separately from the unfiltered one', async () => {
    const { queryClient, wrapper } = wrapperFor()
    const { result } = renderHook(() => useReviewsQuery({ ratingFilter: [5] }), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(
      queryClient.getQueryData([...PARTNER_REVIEWS_QUERY_KEY, { ratingFilter: [5] }]),
    ).toBeDefined()
  })

  it('surfaces a server failure to the caller', async () => {
    server.use(
      http.get(`*${PARTNER_REVIEWS_ENDPOINTS.reviews}`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL', message: 'Reviews unavailable.' } },
          { status: 500 },
        ),
      ),
    )
    const { result } = renderList()

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as HttpError).status).toBe(500)
  })
})

describe('useReviewDetailQuery', () => {
  it('does not fire until a review is opened', () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useReviewDetailQuery(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })

  it('loads the review once opened', async () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useReviewDetailQuery('r-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.reviewId).toBe('r-1')
    // The modal's own date format, not the row's.
    expect(result.current.data?.date).toBe('15 Apr 2026')
  })

  it('does not fire without a session even with a review id', () => {
    tokenStore.clear()
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useReviewDetailQuery('r-1'), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })

  it('keys each review separately', async () => {
    const { queryClient, wrapper } = wrapperFor()
    const { result } = renderHook(() => useReviewDetailQuery('r-2'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(queryClient.getQueryData([...PARTNER_REVIEWS_QUERY_KEY, 'r-2'])).toBeDefined()
    expect(queryClient.getQueryData([...PARTNER_REVIEWS_QUERY_KEY, 'r-1'])).toBeUndefined()
  })

  it('surfaces the 404 for a review that is gone', async () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useReviewDetailQuery('r-nope'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as HttpError).status).toBe(404)
  })
})
