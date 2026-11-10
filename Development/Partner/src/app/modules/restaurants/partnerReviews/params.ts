import { REVIEWS_PAGE_SIZES, REVIEW_RATINGS, REVIEW_SORT_FIELDS, SORT_ORDERS } from './constants'
import type { ReviewRating, ReviewSortBy, ReviewSortOrder, ReviewsParams } from './types'

/**
 * Params for the reviews list.
 *
 * Everything is validated and anything unrecognised is **dropped** rather than
 * forwarded, the same approach as J5 Finances and J6F.
 *
 * The reason differs here, though, and it is worth being explicit: this endpoint
 * never 422s. A bad `sortBy` or a nonsense `ratingFilter` is clamped or ignored
 * server-side and the list still renders. So sanitising is not about avoiding a
 * rejection — it is about not *silently* getting a different result than the UI
 * claims. Sending `sortBy=uploadedAt` would leave the header showing a sort the
 * server never applied.
 */

type RawParams = Partial<Record<keyof ReviewsParams, unknown>>

function asOneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined
}

function asPage(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined
}

function asPageSize(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value)
  return (REVIEWS_PAGE_SIZES as readonly number[]).includes(parsed) ? parsed : undefined
}

/**
 * The multi-value counterpart to {@link asOneOf}, which this module needed and the
 * codebase did not yet have.
 *
 * `asOneOf` rejects an array outright, so it cannot express "a subset of 1–5".
 * This keeps the recognised members in the order the caller gave, drops
 * unrecognised ones individually rather than failing the whole filter, and
 * de-duplicates — a repeated value would otherwise be sent twice for no reason.
 * Returns `undefined` rather than `[]` when nothing survives, so the key is
 * omitted from the query string instead of being sent empty.
 *
 * Constrained to numeric members because it coerces before matching: a filter
 * control reports `['5']` for a column declared with the number `5`.
 */
function asManyOf<T extends number>(value: unknown, allowed: readonly T[]): T[] | undefined {
  if (!Array.isArray(value)) return undefined

  const kept = value
    .map((entry): number => (typeof entry === 'number' ? entry : Number(entry)))
    .filter((entry): entry is T => (allowed as readonly number[]).includes(entry))

  const unique = [...new Set(kept)]
  return unique.length > 0 ? unique : undefined
}

/** Validates untrusted params — from component state, a filter control, or a URL. */
export function sanitiseReviewsParams(raw: RawParams = {}): ReviewsParams {
  const page = asPage(raw.page)
  const pageSize = asPageSize(raw.pageSize)
  const sortBy = asOneOf<ReviewSortBy>(raw.sortBy, REVIEW_SORT_FIELDS)
  const sortOrder = asOneOf<ReviewSortOrder>(raw.sortOrder, SORT_ORDERS)
  const ratingFilter = asManyOf<ReviewRating>(raw.ratingFilter, REVIEW_RATINGS)
  const search = typeof raw.search === 'string' ? raw.search.trim() : ''

  return {
    ...(search ? { search } : {}),
    ...(ratingFilter ? { ratingFilter } : {}),
    ...(sortBy ? { sortBy } : {}),
    // Ordering without a field is meaningless, so it is never sent alone.
    ...(sortBy && sortOrder ? { sortOrder } : {}),
    ...(page !== undefined ? { page } : {}),
    ...(pageSize !== undefined ? { pageSize } : {}),
  }
}

function appendDefined(search: URLSearchParams, key: string, value: string | number | undefined) {
  if (value !== undefined) search.set(key, String(value))
}

export function buildReviewsQuery(params: ReviewsParams): string {
  const search = new URLSearchParams()

  appendDefined(search, 'search', params.search)
  // Repeated keys rather than CSV — the backend accepts both, and repetition is
  // what J3's `buildUsersQueryString` established for a multi-value filter.
  params.ratingFilter?.forEach((rating) => search.append('ratingFilter', String(rating)))
  appendDefined(search, 'sortBy', params.sortBy)
  appendDefined(search, 'sortOrder', params.sortOrder)
  appendDefined(search, 'page', params.page)
  appendDefined(search, 'pageSize', params.pageSize)

  const query = search.toString()
  return query ? `?${query}` : ''
}

/**
 * Reads the ratings the grid's filter control reports.
 *
 * AntD hands back `string[] | null` per column, and the values arrive as strings
 * even though the column's `filters` were declared with numbers — hence the
 * coercion inside `asManyOf`. Unlike J6F's single-status `statusFromFilter`, this
 * endpoint takes a subset, so every recognised value is kept.
 *
 * Returns `[]` rather than `undefined` for "no filter", because the controller
 * holds this as array state and the column's `filteredValue` reads it directly.
 */
export function ratingsFromFilter(value: unknown): ReviewRating[] {
  const list = Array.isArray(value) ? value : value == null ? [] : [value]
  return asManyOf<ReviewRating>(list, REVIEW_RATINGS) ?? []
}
