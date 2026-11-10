import { IT_PAGE_SIZES, VISIBLE_IT_STATUSES } from './constants'
import type { InterestTableStatus, InterestTablesParams } from './types'

/**
 * Params for the interest-tables grid.
 *
 * Everything is validated and anything unrecognised is **dropped** rather than
 * forwarded, so the backend applies its own default instead of rejecting the
 * request — the J5 Finances approach. That matters most for `status`: `DRAFT` is
 * not a partner-visible status (BR-03), so a hand-edited URL asking for it must
 * degrade to "all" rather than error or leak Draft rows.
 */

type RawParams = Partial<Record<keyof InterestTablesParams, unknown>>

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
  return (IT_PAGE_SIZES as readonly number[]).includes(parsed) ? parsed : undefined
}

/** Validates untrusted params — from the URL, storage, or component state. */
export function sanitiseInterestTablesParams(raw: RawParams = {}): InterestTablesParams {
  const page = asPage(raw.page)
  const pageSize = asPageSize(raw.pageSize)
  const status = asOneOf<InterestTableStatus>(raw.status, VISIBLE_IT_STATUSES)
  const sortOrder = asOneOf<'asc' | 'desc'>(raw.sortOrder, ['asc', 'desc'])
  const sortBy = typeof raw.sortBy === 'string' && raw.sortBy.trim() ? raw.sortBy.trim() : undefined

  return {
    ...(page !== undefined ? { page } : {}),
    ...(pageSize !== undefined ? { pageSize } : {}),
    ...(status ? { status } : {}),
    ...(sortBy ? { sortBy } : {}),
    // Ordering without a field is meaningless, so it is never sent alone.
    ...(sortBy && sortOrder ? { sortOrder } : {}),
  }
}

function appendDefined(search: URLSearchParams, key: string, value: string | number | undefined) {
  if (value !== undefined) search.set(key, String(value))
}

export function buildInterestTablesQuery(params: InterestTablesParams): string {
  const search = new URLSearchParams()

  appendDefined(search, 'page', params.page)
  appendDefined(search, 'pageSize', params.pageSize)
  appendDefined(search, 'status', params.status)
  appendDefined(search, 'sortBy', params.sortBy)
  appendDefined(search, 'sortOrder', params.sortOrder)

  const query = search.toString()
  return query ? `?${query}` : ''
}

/**
 * Reads the status the grid's filter control reports.
 *
 * AntD hands back `string[] | null` per column; the endpoint takes a single
 * status, so only the first usable value is kept and anything else clears the
 * filter.
 */
export function statusFromFilter(value: unknown): InterestTableStatus | undefined {
  const first = Array.isArray(value) ? value[0] : value
  return asOneOf<InterestTableStatus>(first, VISIBLE_IT_STATUSES)
}
