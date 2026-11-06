import type { REVIEW_RATINGS, REVIEW_SORT_FIELDS, SORT_ORDERS } from './constants'

export type ReviewSortBy = (typeof REVIEW_SORT_FIELDS)[number]
export type ReviewSortOrder = (typeof SORT_ORDERS)[number]
export type ReviewRating = (typeof REVIEW_RATINGS)[number]

/**
 * The reviewer.
 *
 * `name` is nullable — a deleted Mingler leaves the review behind. `minglerId`
 * always resolves, and it is what opens J6F's Mingler profile modal (BR-07);
 * that endpoint answers "Profile unavailable" for a deleted account, so the id
 * stays useful even when the name is gone.
 */
export interface ReviewMingler {
  minglerId: string
  name: string | null
}

/**
 * The interest table the review's booking belongs to (BR-04 — **both** fields
 * are shown, not just the topic).
 *
 * Both are nullable: a retired topic or a since-removed table leaves them null.
 */
export interface ReviewInterestTable {
  name: string | null
  topic: string | null
}

export interface ReviewListItem {
  reviewId: string
  /**
   * Pre-formatted `DD-MM-YYYY`, Asia/Karachi. **Render verbatim** — this is not a
   * parseable ISO date, and `dayjs('15-04-2026')` is an Invalid Date. The detail
   * endpoint deliberately formats the same field differently; see
   * {@link ReviewDetail.date}.
   */
  date: string
  mingler: ReviewMingler
  interestTable: ReviewInterestTable
  rating: ReviewRating
  /**
   * Nullable: a review can be a rating (and photos) with no words at all.
   *
   * This is the **complete** text, not a server-truncated preview — truncating it
   * for the row is the client's job.
   */
  text: string | null
  /**
   * **Not thumbnails.** There is no thumbnail derivative on the platform; these
   * are the identical full-size CloudFront URLs the detail returns as `photos`.
   * Constrain the rendered box in CSS and lazy-load them, or a row with several
   * photos pulls full-resolution images into a 40px slot.
   *
   * Empty in every environment at present — the review-photos bucket is not
   * configured yet, so `[]` is the normal case rather than a failure.
   */
  photoThumbnails: string[]
  /**
   * Always present: `reviews.booking_id` went `NOT NULL` in CR-021. The spec's
   * "hide the icon when null" branch (AC-04.2) is therefore unreachable, and the
   * row icon renders unconditionally.
   */
  bookingId: string
}

/**
 * The ratings summary (BR-03) — average, all-time count, and the 1–5★ histogram.
 *
 * `total` is **every** review the restaurant has ever received and does not move
 * when a filter is applied. It is not the same number as
 * {@link ReviewsPagination.totalRecords}, and both are correct: with a 5★ filter
 * active the headline still reads "8 reviews" above 3 rows. Wiring the headline to
 * the filtered count is the mistake this comment exists to prevent.
 */
export interface ReviewsSummary {
  average: number
  total: number
  /** All five keys are always present, so no missing-key guard is needed. */
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>
}

/**
 * Nested, matching the majority house shape — field-for-field identical to J3's
 * `PartnerUsersPagination` and J5's `FinancesPagination`. (The spec's example
 * showed flat `page`/`pageSize`/`total` at the top level; the implementation does
 * not, and the nested form is what the rest of this app already speaks.)
 */
export interface ReviewsPagination {
  page: number
  pageSize: number
  /** How many reviews match the **current filters**. */
  totalRecords: number
  totalPages: number
}

export interface ReviewsPage {
  summary: ReviewsSummary
  items: ReviewListItem[]
  pagination: ReviewsPagination
}

/**
 * Params for the reviews list. Every one is optional — the endpoint applies its
 * own defaults for anything omitted.
 */
export interface ReviewsParams {
  search?: string
  /** Repeated on the wire (`?ratingFilter=5&ratingFilter=4`), never comma-joined. */
  ratingFilter?: ReviewRating[]
  sortBy?: ReviewSortBy
  sortOrder?: ReviewSortOrder
  page?: number
  pageSize?: number
}

/**
 * The Review Details modal (BR-06). Read-only, close-only.
 *
 * Carries `interestTable` and `bookingId` beyond what the spec's example showed,
 * so the modal can offer the same "view booking" jump as the row icon.
 */
export interface ReviewDetail {
  reviewId: string
  mingler: ReviewMingler
  interestTable: ReviewInterestTable
  rating: ReviewRating
  /**
   * Pre-formatted `DD MMM YYYY` — e.g. `15 Apr 2026`. Deliberately a different
   * format from the list's `DD-MM-YYYY`; both arrive ready to render and neither
   * should be reformatted.
   */
  date: string
  /** The full, untruncated review. */
  text: string | null
  /** Full-size CloudFront URLs; `[]` until the review-photos bucket is configured. */
  photos: string[]
  bookingId: string
}
