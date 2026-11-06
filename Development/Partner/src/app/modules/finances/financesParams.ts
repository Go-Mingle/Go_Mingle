import {
  FINANCES_DEFAULT_PERIOD,
  FINANCES_PAGE_SIZES,
  FINANCES_PERIODS,
  FINANCES_SEARCH_FIELDS,
  FINANCES_SORT_FIELDS,
} from './constants'
import type {
  FinancesExportParams,
  FinancesLedgerParams,
  FinancesPeriod,
  FinancesSearchField,
  FinancesSortBy,
  FinancesSortOrder,
} from './types'

/**
 * Params for the Finances endpoints.
 *
 * These routes are stricter than the rest of the portal: a bad `sortBy`,
 * `pageSize`, `period` or date range is a **422**, where the J3 users grid and
 * the J4 deliveries log quietly fall back to defaults. That matters because the
 * filter survives navigation through the URL — a stale link or an old bookmark
 * would otherwise turn into an error page on a screen that used to work.
 *
 * So every value is validated here and anything unrecognised is *dropped*,
 * letting the backend apply its own default rather than rejecting the request.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

type RawParams = Partial<Record<keyof FinancesLedgerParams, unknown>>

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
  return (FINANCES_PAGE_SIZES as readonly number[]).includes(parsed) ? parsed : undefined
}

function asIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return undefined
  // Rejects 2026-02-31 and friends, which match the shape but are not real days.
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(value)
    ? undefined
    : value
}

/**
 * Resolves the date filter into one of the two shapes the backend accepts: a
 * preset alone, or `dateFrom` + `dateTo` with no preset. Sending both is a 422,
 * and `CUSTOM` without both dates is a 422.
 */
function resolveDateFilter(raw: RawParams): {
  period?: FinancesPeriod
  dateFrom?: string
  dateTo?: string
} {
  const period = asOneOf<FinancesPeriod>(raw.period, FINANCES_PERIODS)
  const dateFrom = asIsoDate(raw.dateFrom)
  const dateTo = asIsoDate(raw.dateTo)
  // A half-open or inverted range is not a filter the backend will accept.
  const hasRange = !!dateFrom && !!dateTo && dateFrom <= dateTo

  if (hasRange) return { dateFrom, dateTo }
  // CUSTOM without a usable range would 422; fall back to the default preset.
  if (period === 'CUSTOM') return {}
  if (period) return { period }
  return {}
}

function resolveSearch(raw: RawParams): { searchField?: FinancesSearchField; search?: string } {
  const searchField = asOneOf<FinancesSearchField>(raw.searchField, FINANCES_SEARCH_FIELDS)
  // Search does nothing without a field (BR-07), so neither is sent alone.
  if (!searchField) return {}
  const search = typeof raw.search === 'string' ? raw.search.trim() : ''
  return search ? { searchField, search } : {}
}

/** Validates untrusted params — from the URL, storage, or component state. */
export function sanitiseLedgerParams(raw: RawParams = {}): FinancesLedgerParams {
  return {
    ...(asPage(raw.page) !== undefined ? { page: asPage(raw.page) } : {}),
    ...(asPageSize(raw.pageSize) !== undefined ? { pageSize: asPageSize(raw.pageSize) } : {}),
    ...(asOneOf<FinancesSortBy>(raw.sortBy, FINANCES_SORT_FIELDS)
      ? { sortBy: asOneOf<FinancesSortBy>(raw.sortBy, FINANCES_SORT_FIELDS) }
      : {}),
    ...(asOneOf<FinancesSortOrder>(raw.sortOrder, ['asc', 'desc'])
      ? { sortOrder: asOneOf<FinancesSortOrder>(raw.sortOrder, ['asc', 'desc']) }
      : {}),
    ...resolveSearch(raw),
    ...resolveDateFilter(raw),
  }
}

/**
 * True when the params narrow the ledger — a column search, a custom date range,
 * or any period other than the default All Time.
 *
 * Sorting and paging are excluded on purpose: they reorder and slice, they never
 * remove, so an empty grid under a sort alone still means "no earnings yet".
 * That split is the whole point — an unfiltered empty ledger and a filter that
 * matched nothing need different copy, and only the second one has a filter the
 * partner has to be able to reach and clear (MET-1301).
 */
export function hasNarrowingFilters(params: FinancesLedgerParams): boolean {
  return Boolean(
    params.search?.trim() ||
      (params.dateFrom && params.dateTo) ||
      (params.period && params.period !== FINANCES_DEFAULT_PERIOD),
  )
}

/**
 * The export takes the same filters but rejects pagination outright — it is
 * always the whole filtered set, never a page.
 */
export function toExportParams(params: FinancesLedgerParams): FinancesExportParams {
  const { page: _page, pageSize: _pageSize, ...filters } = params
  void _page
  void _pageSize
  return filters
}

function appendDefined(search: URLSearchParams, key: string, value: string | number | undefined) {
  if (value !== undefined) search.set(key, String(value))
}

export function buildFinancesQuery(params: FinancesLedgerParams | FinancesExportParams): string {
  const search = new URLSearchParams()
  const withPaging = params as FinancesLedgerParams

  appendDefined(search, 'page', withPaging.page)
  appendDefined(search, 'pageSize', withPaging.pageSize)
  appendDefined(search, 'sortBy', params.sortBy)
  appendDefined(search, 'sortOrder', params.sortOrder)
  appendDefined(search, 'searchField', params.searchField)
  appendDefined(search, 'search', params.search)
  appendDefined(search, 'period', params.period)
  appendDefined(search, 'dateFrom', params.dateFrom)
  appendDefined(search, 'dateTo', params.dateTo)

  const query = search.toString()
  return query ? `?${query}` : ''
}
