/**
 * J6G Restaurant Profile — Reviews (Partner Portal).
 *
 * Two client-callable endpoints over J10D's `reviews`. J6G is a **read-only
 * mirror** of the admin reviews view: there is no delete, reply or flag, and no
 * endpoint behind one — moderation is admin-only (BR-02). J6G owns no schema and
 * writes nothing.
 *
 * No restaurant id appears on either route — it is resolved from the access token
 * (F1 BR-04), same as J6A–J6F.
 */
const ROOT = '/api/v1/partner'

export const PARTNER_REVIEWS_ENDPOINTS = {
  reviews: `${ROOT}/reviews`,
  reviewById: (reviewId: string) => `${ROOT}/reviews/${reviewId}`,
} as const

/**
 * Query keys.
 *
 * The list is keyed with its params so each page, search, sort and rating-filter
 * combination caches separately rather than clobbering one entry.
 */
export const PARTNER_REVIEWS_QUERY_KEY = ['partner', 'reviews'] as const
export const partnerReviewDetailKey = (reviewId: string) =>
  [...PARTNER_REVIEWS_QUERY_KEY, reviewId] as const

/**
 * Page sizes the endpoint accepts; the first is the default.
 *
 * **Only these three.** The backend rejects anything else, and its default is 10 —
 * not the 25 the spec's example response shows. This narrower set is why the tab
 * cannot reuse the shared `UsersPagination`, whose dropdown is built from
 * `USERS_PAGE_SIZE_OPTIONS` and would offer a `100 / page` the server refuses:
 * the control would report a size that never took effect. J5 Finances hit the
 * same mismatch and rendered its own row for the same reason.
 */
export const REVIEWS_PAGE_SIZES = [10, 25, 50] as const
export const REVIEWS_DEFAULT_PAGE_SIZE = 10

/** BR-05 — the two sortable columns. Default is Date, newest first. */
export const REVIEW_SORT_FIELDS = ['date', 'rating'] as const
export const SORT_ORDERS = ['asc', 'desc'] as const
export const REVIEWS_DEFAULT_SORT_BY = 'date'
export const REVIEWS_DEFAULT_SORT_ORDER = 'desc'

/**
 * The rating values the filter offers (BR-05).
 *
 * Also the keys of `summary.distribution`, which always carries all five — so the
 * histogram can be driven straight off this without guarding for a missing key.
 */
export const REVIEW_RATINGS = [1, 2, 3, 4, 5] as const

/**
 * J6G-specific error codes: **none**.
 *
 * The spec's §4.3 confirms it — the tab is read-only, so the only codes in play
 * are F1's, and `ERR_NOT_FOUND` is the only one needing its own copy. It lives in
 * the shared `ERROR_CODES` catalogue, so this module declares no code map.
 *
 * Note also that the **list** endpoint never returns a 422: a bad `sortBy`, an
 * over-long `search` or a nonsense `ratingFilter` is clamped or ignored and the
 * list still renders. There is deliberately no validation-error path for it.
 */
