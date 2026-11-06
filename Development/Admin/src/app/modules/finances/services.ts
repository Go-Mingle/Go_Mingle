import { httpClient } from '../../../shared/api/httpClient'
import {
  FINANCES_ENDPOINTS,
  FINANCES_PAGE_SIZE,
  FINANCE_SEARCH_FIELDS,
  FINANCE_SEARCH_TERM_MAX_LENGTH,
} from './constants'
import type {
  FinanceExportResult,
  FinanceListItem,
  FinanceListResponse,
  FinanceListResult,
  FinanceRecord,
  FinanceRecordDetail,
  ListFinancesQueryParams,
} from './types'

function mapFinanceListItem(item: FinanceListItem): FinanceRecord {
  return {
    id: item.bookingRef,
    bookingId: item.bookingRef,
    restaurant: item.restaurant.name,
    restaurantId: item.restaurant.id,
    restaurantCity: item.restaurant.city ?? undefined,
    restaurantAddress: item.restaurant.address ?? undefined,
    restaurantInfo: {
      name: item.restaurant.name,
      address: item.restaurant.address ?? '',
      city: item.restaurant.city ?? '',
    },
    mingler: item.mingler.name,
    minglerId: item.mingler.id,
    interestTableTopic: item.interestTableName,
    date: item.date,
    totalAmount: item.totalAmountPkr,
    // Populated by the list endpoint (CR-42); left optional so a row missing
    // them maps to undefined and the grid renders '—'.
    partnerShare: item.partnerSharePkr,
    gomingleShare: item.gomingleSharePkr,
  }
}

// `includePaging` is off for the CSV export (MET-1308): the export endpoint takes
// the same query DTO as the list but returns every matched row, so it needs the
// filters/sort and must not be handed page bounds.
function buildFinancesQuery(params: ListFinancesQueryParams, includePaging = true): string {
  const qs = new URLSearchParams()
  // CR-62 / MET-753 — each searchable column carries its own parameter and the
  // backend AND-combines them, so several column filters can be active at once.
  // The previous single `q` + `searchField` pair could only express one.
  for (const field of FINANCE_SEARCH_FIELDS) {
    const term = params[field]?.trim().slice(0, FINANCE_SEARCH_TERM_MAX_LENGTH)
    if (term) qs.set(field, term)
  }
  if (params.dateFrom) qs.set('dateFrom', params.dateFrom)
  if (params.dateTo) qs.set('dateTo', params.dateTo)
  if (includePaging) {
    qs.set('page', String(params.page ?? 1))
    qs.set('pageSize', String(params.pageSize ?? FINANCES_PAGE_SIZE))
  }
  if (params.sortBy) qs.set('sortBy', params.sortBy)
  if (params.sortOrder) qs.set('sortOrder', params.sortOrder)
  return qs.toString()
}

export const financesService = {
  /** Fetch a page of finance / transaction records matching the given filters/sort. */
  getAll: async (params: ListFinancesQueryParams = {}): Promise<FinanceListResult> => {
    const response = await httpClient.get<FinanceListResponse>(
      `${FINANCES_ENDPOINTS.list}?${buildFinancesQuery(params)}`,
    )
    return { items: response.items.map(mapFinanceListItem), pagination: response.pagination }
  },
  /**
   * Request a signed URL to the generated finances CSV export. Takes the same
   * filters/sort as `getAll` so the CSV matches what the grid is showing
   * (MET-1308) — pagination is deliberately dropped: the export is un-paginated.
   */
  exportCsv: (params: ListFinancesQueryParams = {}): Promise<FinanceExportResult> => {
    const query = buildFinancesQuery(params, false)
    return httpClient.get<FinanceExportResult>(
      query ? `${FINANCES_ENDPOINTS.export}?${query}` : FINANCES_ENDPOINTS.export,
    )
  },
  /** Fetch a single finance record's detail by booking id. */
  getDetail: (bookingId: string): Promise<FinanceRecordDetail> =>
    httpClient.get<FinanceRecordDetail>(FINANCES_ENDPOINTS.detail(bookingId)),
}
