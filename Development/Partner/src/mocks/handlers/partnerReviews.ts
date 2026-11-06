import { http } from 'msw'
import { PARTNER_REVIEWS_ENDPOINTS } from '../../app/modules/restaurants/partnerReviews/constants'
import { listMockReviews, mockReviewDetail } from '../data/partnerReviews'
import type { ReviewsQuery } from '../data/partnerReviews'

function readQuery(url: string): ReviewsQuery {
  const params = new URL(url).searchParams
  return {
    search: params.get('search'),
    // Accepted as repeated keys (`?ratingFilter=5&ratingFilter=4`) or as CSV
    // (`?ratingFilter=5,4`), matching the backend, which takes either.
    ratingFilter: params
      .getAll('ratingFilter')
      .flatMap((value) => value.split(','))
      .filter(Boolean),
    sortBy: params.get('sortBy'),
    sortOrder: params.get('sortOrder'),
    page: params.get('page'),
    pageSize: params.get('pageSize'),
  }
}

/**
 * J6G's two read-only endpoints.
 *
 * The literal list route is registered before `/:reviewId` so it is not swallowed as
 * a review id — the same ordering J6B and J6F needed.
 *
 * There is deliberately no delete, reply or flag route: moderation is admin-only
 * (BR-02), and a mock for a mutation the partner cannot perform would invite one to
 * be built.
 */
export const partnerReviewsHandlers = [
  http.get(PARTNER_REVIEWS_ENDPOINTS.reviews, ({ request }) =>
    listMockReviews(readQuery(request.url)),
  ),

  http.get(PARTNER_REVIEWS_ENDPOINTS.reviewById(':reviewId'), ({ params }) =>
    mockReviewDetail(String(params.reviewId)),
  ),
]
