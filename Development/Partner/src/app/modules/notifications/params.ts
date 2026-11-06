import { NOTIFICATION_PAGE_SIZES, NOTIFICATION_SORT_DIRS, NOTIFICATION_STATUSES } from './constants'
import type { NotificationSortDir, NotificationStatus, NotificationsParams } from './types'

/**
 * Params for the notifications list.
 *
 * Everything is validated and anything unrecognised is **dropped** rather than
 * forwarded — the same approach as J5, J6F and J6G, but for a different reason.
 * Those endpoints ignore a bad param; this one **rejects** it (422 for an unknown
 * `type`/`status`/`sortDir`/`pageSize`, 400 for a broken date range). So dropping is
 * not politeness here, it is what stops a stale filter turning the whole screen into
 * an error panel.
 *
 * The one thing deliberately *not* dropped is a half-supplied date range: see
 * {@link isDateRangeComplete}.
 */

type RawParams = Partial<Record<keyof NotificationsParams, unknown>>

/** The API's own cap on the search term. Trimmed to it rather than rejected. */
const MAX_SEARCH_LENGTH = 255

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
  return (NOTIFICATION_PAGE_SIZES as readonly number[]).includes(parsed) ? parsed : undefined
}

/**
 * The repeatable `type` filter.
 *
 * Unlike J6G's rating filter there is no closed set to check against — the catalogue
 * is fetched at runtime and an unknown key is legal on a *row*. What is not legal is
 * sending one as a *filter*: the endpoint 422s. So this keeps any non-empty string,
 * de-duplicates, and leaves the catalogue to decide what the UI offers. Returns
 * `undefined` rather than `[]` when nothing survives, so the key is omitted instead of
 * sent empty.
 */
function asTypeKeys(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined

  const kept = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)

  const unique = [...new Set(kept)]
  return unique.length > 0 ? unique : undefined
}

/** ISO `YYYY-MM-DD`, which is what the date picker hands over. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function asIsoDate(value: unknown): string | undefined {
  return typeof value === 'string' && ISO_DATE.test(value) ? value : undefined
}

/**
 * True only when **both** ends of the range are present and valid.
 *
 * One date alone is a 400 (`ERR_DATE_RANGE_INCOMPLETE`), so the Apply button and the
 * query string have to agree on exactly one rule — hence one exported predicate used
 * by both rather than two near-identical checks that could drift.
 */
export function isDateRangeComplete(startDate: unknown, endDate: unknown): boolean {
  return asIsoDate(startDate) !== undefined && asIsoDate(endDate) !== undefined
}

/** Validates untrusted params — from component state, a filter control, or a URL. */
export function sanitiseNotificationsParams(raw: RawParams = {}): NotificationsParams {
  const page = asPage(raw.page)
  const pageSize = asPageSize(raw.pageSize)
  const status = asOneOf<NotificationStatus>(raw.status, NOTIFICATION_STATUSES)
  const sortDir = asOneOf<NotificationSortDir>(raw.sortDir, NOTIFICATION_SORT_DIRS)
  const type = asTypeKeys(raw.type)

  const trimmed = typeof raw.search === 'string' ? raw.search.trim() : ''
  const search = trimmed ? trimmed.slice(0, MAX_SEARCH_LENGTH) : undefined

  // Both or neither. A single date would be a 400, so a half-set range is dropped
  // entirely rather than sent and rejected.
  const complete = isDateRangeComplete(raw.startDate, raw.endDate)
  const startDate = complete ? asIsoDate(raw.startDate) : undefined
  const endDate = complete ? asIsoDate(raw.endDate) : undefined

  return {
    ...(search ? { search } : {}),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(startDate && endDate ? { startDate, endDate } : {}),
    ...(sortDir ? { sortDir } : {}),
    ...(page !== undefined ? { page } : {}),
    ...(pageSize !== undefined ? { pageSize } : {}),
  }
}

function appendDefined(search: URLSearchParams, key: string, value: string | number | undefined) {
  if (value !== undefined) search.set(key, String(value))
}

export function buildNotificationsQuery(params: NotificationsParams): string {
  const search = new URLSearchParams()

  appendDefined(search, 'search', params.search)
  // Repeated keys rather than CSV, following J3's `buildUsersQueryString`.
  params.type?.forEach((key) => search.append('type', key))
  appendDefined(search, 'status', params.status)
  appendDefined(search, 'startDate', params.startDate)
  appendDefined(search, 'endDate', params.endDate)
  appendDefined(search, 'sortDir', params.sortDir)
  appendDefined(search, 'page', params.page)
  appendDefined(search, 'pageSize', params.pageSize)

  const query = search.toString()
  return query ? `?${query}` : ''
}

/**
 * Whether any filter is narrowing the list.
 *
 * Drives the difference between the two full-screen empty states (BR-14): an
 * untouched screen with no rows means the inbox is empty, whereas a filtered one
 * means the filters matched nothing and needs a clear-filters affordance. The API
 * returns the same empty `items` for both, so the client has to know which it is.
 *
 * `status: 'ALL'` and the default sort are not filters — they are the absence of one.
 */
export function hasActiveFilters(params: NotificationsParams): boolean {
  return Boolean(
    params.search ||
    params.type?.length ||
    (params.status && params.status !== 'ALL') ||
    (params.startDate && params.endDate),
  )
}
