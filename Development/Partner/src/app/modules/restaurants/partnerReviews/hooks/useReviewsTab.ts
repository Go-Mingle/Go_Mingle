import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProfileFeedback } from '../../partnerProfile/hooks/useProfileFeedback'
import {
  REVIEWS_DEFAULT_PAGE_SIZE,
  REVIEWS_DEFAULT_SORT_BY,
  REVIEWS_DEFAULT_SORT_ORDER,
} from '../constants'
import { isReviewNotFound } from '../errors'
import { ratingsFromFilter, sanitiseReviewsParams } from '../params'
import type { ReviewRating, ReviewSortBy, ReviewSortOrder } from '../types'
import { useReviewsFeedback } from './useReviewsFeedback'
import {
  useRefreshReviews,
  useReviewDetailQuery,
  useReviewsQuery,
} from './usePartnerReviewsQueries'

/**
 * The Reviews tab (US-01 to US-04).
 *
 * Read-only, with no moderation affordance of any kind (BR-02) — and, unlike the other
 * profile tabs, no `editable` flag either: there is nothing to gate, and the tab renders
 * in every profile state including PENDING (BR-11).
 *
 * Search, the rating filter, sorting and paging are all **server-side**. The prototype
 * did every one of them in memory, which meant the row count disagreed with the total
 * and the histogram described only the page on screen.
 */
export function useReviewsTab(feedback: ProfileFeedback) {
  const { showReviewGone } = useReviewsFeedback(feedback)
  const refreshReviews = useRefreshReviews()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(REVIEWS_DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [ratingFilter, setRatingFilter] = useState<ReviewRating[]>([])
  const [sortBy, setSortBy] = useState<ReviewSortBy>(REVIEWS_DEFAULT_SORT_BY)
  const [sortOrder, setSortOrder] = useState<ReviewSortOrder>(REVIEWS_DEFAULT_SORT_ORDER)

  const [openReviewId, setOpenReviewId] = useState<string | null>(null)
  const [openMinglerId, setOpenMinglerId] = useState<string | null>(null)
  const [openBookingId, setOpenBookingId] = useState<string | null>(null)

  // Sanitised on the way out, so a value that drifted out of range never reaches the
  // query string. This endpoint ignores a bad param rather than rejecting it, so
  // without this the UI could show a sort the server never applied.
  const params = useMemo(
    () => sanitiseReviewsParams({ page, pageSize, search, ratingFilter, sortBy, sortOrder }),
    [page, pageSize, search, ratingFilter, sortBy, sortOrder],
  )

  const listQuery = useReviewsQuery(params)
  const detailQuery = useReviewDetailQuery(openReviewId)

  const closeReview = useCallback(() => setOpenReviewId(null), [])

  /**
   * A 404 on the detail means the review is gone — an admin deleted it, or it was never
   * this restaurant's to read (the API returns the same 404 for both). Three things
   * follow: the modal closes, the partner is told once, and the list is re-read so the
   * stale row disappears.
   *
   * The close is **derived** rather than a `setOpenReviewId(null)` in the effect below.
   * Setting state synchronously inside an effect triggers a second render pass, and the
   * `react-hooks/set-state-in-effect` rule rightly rejects it — so the modal simply
   * stops being open while the error stands, with no extra render.
   */
  const reviewGone = isReviewNotFound(detailQuery.error)

  /**
   * The toast and the cache invalidation, on the other hand, genuinely are
   * external-system side effects, which is what an effect is for. React Query v5 removed
   * `onError` for queries, so this is where they belong.
   *
   * The ref makes it fire once per review rather than on every render while the error is
   * cached — otherwise a re-render would toast again.
   */
  const reportedGone = useRef<string | null>(null)

  useEffect(() => {
    if (!openReviewId || !reviewGone || reportedGone.current === openReviewId) return

    reportedGone.current = openReviewId
    showReviewGone()
    refreshReviews()
  }, [openReviewId, reviewGone, showReviewGone, refreshReviews])

  /**
   * Any change to search, filtering or sorting returns to the first page.
   *
   * Without this, filtering while on page 4 asks for page 4 of a much shorter result
   * set and lands on an empty table that reads as "no reviews".
   */
  const applySearch = useCallback((next: string) => {
    setSearch(next)
    setPage(1)
  }, [])

  const applyRatingFilter = useCallback((next: unknown) => {
    setRatingFilter(ratingsFromFilter(next))
    setPage(1)
  }, [])

  const applySort = useCallback((field: ReviewSortBy, order: ReviewSortOrder) => {
    setSortBy(field)
    setSortOrder(order)
    setPage(1)
  }, [])

  const changePageSize = useCallback((next: number) => {
    setPageSize(next)
    setPage(1)
  }, [])

  const summary = listQuery.data?.summary
  const pagination = listQuery.data?.pagination

  return {
    items: listQuery.data?.items ?? [],

    /**
     * The all-time summary, deliberately separate from `total` below.
     *
     * `summary.total` counts every review the restaurant has ever received and does
     * **not** move when a filter is applied; `total` is how many match the current
     * filters. Both are correct, and with a 5★ filter active the headline legitimately
     * reads "8 reviews" above 3 rows. They are exposed under different names so a
     * caller cannot reach for the wrong one by accident.
     */
    summary,
    /** The **filtered** count, for the pager only. */
    total: pagination?.totalRecords ?? 0,

    page,
    pageSize,
    search,
    ratingFilter,
    sortBy,
    sortOrder,

    isPending: listQuery.isPending,
    isError: listQuery.isError,
    error: listQuery.error,
    /** True while a page, search, sort or filter change is in flight over previous results. */
    isFetching: listQuery.isFetching,
    /** True when the tab has loaded and the restaurant has no reviews at all (BR-09). */
    isEmpty: !listQuery.isPending && !listQuery.isError && (summary?.total ?? 0) === 0,
    /** True when filters are narrowing an otherwise non-empty set to nothing. */
    hasFilters: Boolean(search) || ratingFilter.length > 0,

    changePage: setPage,
    changePageSize,
    applySearch,
    applyRatingFilter,
    applySort,

    // ── The review details modal (US-02) ───────────────────────
    /**
     * Null once the review turns out to be gone, which is what closes the modal — see
     * the `reviewGone` note above. The internal id is kept so the failed query stays
     * settled rather than refiring.
     */
    openReviewId: reviewGone ? null : openReviewId,
    openReview: setOpenReviewId,
    closeReview,
    reviewDetail: detailQuery.data,
    reviewDetailPending: detailQuery.isPending,
    /**
     * A 404 is handled above — modal closed, toast, list refreshed — so it is excluded
     * here. What is left is a real failure worth an in-modal alert.
     */
    reviewDetailError: detailQuery.isError && !reviewGone,
    reviewDetailErrorCause: detailQuery.error,

    // ── The two J6F modals (US-03, US-04) ──────────────────────
    openMinglerId,
    openMingler: setOpenMinglerId,
    closeMingler: useCallback(() => setOpenMinglerId(null), []),
    openBookingId,
    openBooking: setOpenBookingId,
    closeBooking: useCallback(() => setOpenBookingId(null), []),
  }
}

export type ReviewsTabController = ReturnType<typeof useReviewsTab>
