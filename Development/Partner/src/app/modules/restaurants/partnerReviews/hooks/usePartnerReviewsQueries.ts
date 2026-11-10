import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { partnerRetryPolicy } from '../../../../../shared/api/retryPolicy'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { PARTNER_REVIEWS_QUERY_KEY, partnerReviewDetailKey } from '../constants'
import { partnerReviewsService } from '../services'
import type { ReviewDetail, ReviewsPage, ReviewsParams } from '../types'

/**
 * J6G's server state — two reads and no writes.
 *
 * There are no mutations to declare: the partner has no delete, reply or flag on any
 * review (BR-02), and no endpoint behind one. An admin deletion simply stops appearing
 * on the next read, so nothing here polls or listens for a moderation signal.
 */

/**
 * The summary + list.
 *
 * Params are part of the key so each page, search, sort and rating-filter combination
 * caches separately rather than clobbering one entry.
 */
export function useReviewsQuery(params: ReviewsParams) {
  return useQuery<ReviewsPage>({
    queryKey: [...PARTNER_REVIEWS_QUERY_KEY, params],
    queryFn: () => partnerReviewsService.listReviews(params),
    enabled: tokenStore.hasSession(),
    // Keeps the current page visible while the next one loads, so paging, sorting and
    // filtering do not blank the table out between reads.
    placeholderData: (previous) => previous,
    ...partnerRetryPolicy,
  })
}

/**
 * One review in full, for the details modal.
 *
 * Fetched only once a row has been opened — `reviewId` is null until then, the same
 * shape J6F's `useBookingQuery` and `useMinglerQuery` use.
 */
export function useReviewDetailQuery(reviewId: string | null) {
  const id = reviewId ?? ''
  return useQuery<ReviewDetail>({
    queryKey: partnerReviewDetailKey(id),
    queryFn: () => partnerReviewsService.getReview(id),
    enabled: id !== '' && tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

/**
 * Re-reads the list after a review turns out to be gone.
 *
 * The only cache write in the module, and it is not a mutation's: a 404 from the
 * detail read means an admin deleted the review, so the list and summary on screen are
 * both stale. Invalidating the list prefix covers every cached page and filter
 * combination at once.
 */
export function useRefreshReviews() {
  const queryClient = useQueryClient()
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: PARTNER_REVIEWS_QUERY_KEY })
  }, [queryClient])
}
