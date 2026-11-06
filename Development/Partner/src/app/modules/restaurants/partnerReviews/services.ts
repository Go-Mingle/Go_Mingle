import { httpClient } from '../../../../shared/api/httpClient'
import { PARTNER_REVIEWS_ENDPOINTS } from './constants'
import { buildReviewsQuery, sanitiseReviewsParams } from './params'
import type { ReviewDetail, ReviewsPage, ReviewsParams } from './types'

export const partnerReviewsService = {
  /**
   * The ratings summary and the reviews list in one read (US-01).
   *
   * Params are sanitised here rather than trusted from the caller, so a value that
   * drifted out of range never reaches the query string. The endpoint would ignore
   * it silently rather than 422, which is precisely why the client has to be the
   * one that cares — see `sanitiseReviewsParams`.
   */
  listReviews: (params: ReviewsParams = {}): Promise<ReviewsPage> =>
    httpClient.get<ReviewsPage>(
      `${PARTNER_REVIEWS_ENDPOINTS.reviews}${buildReviewsQuery(sanitiseReviewsParams(params))}`,
    ),

  /**
   * One review in full, for the read-only details modal (US-02).
   *
   * 404s for a review belonging to another restaurant or one an admin has since
   * deleted — the two are deliberately indistinguishable. Either way it means
   * "this review is gone", so the caller refreshes the list rather than presenting
   * it as a failure.
   */
  getReview: (reviewId: string): Promise<ReviewDetail> =>
    httpClient.get<ReviewDetail>(PARTNER_REVIEWS_ENDPOINTS.reviewById(reviewId)),
}
