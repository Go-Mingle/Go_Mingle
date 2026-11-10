import type { PeriodTab, FinanceSearchField, FinanceSortField } from './types'
import { PAGE_SIZE_OPTIONS } from '../../../shared/constants/pagination'

export const FINANCES_ENDPOINTS = {
  list: '/api/v1/admin/finances',
  export: '/api/v1/admin/finances/export',
  detail: (bookingId: string) => `/api/v1/admin/finances/${bookingId}`,
} as const

// Default pageSize is 10; the selectable options are the app-wide 10/25/50 set.
export const FINANCES_PAGE_SIZE = 10
export const FINANCES_PAGE_SIZE_OPTIONS = PAGE_SIZE_OPTIONS
// Matches INITIAL_QUERY_PARAMS (no dateFrom/dateTo) — the page's actual current default.
export const FINANCES_DEFAULT_PERIOD = 'all_time' as const

// Maps a finance table column key to its own search parameter on the list API
// (CR-62). Only these four columns support server-side search, and the backend
// AND-combines whichever of them are present.
export const FINANCE_SEARCH_FIELD_BY_COLUMN_KEY: Record<string, FinanceSearchField> = {
  bookingId: 'bookingRef',
  restaurant: 'restaurant',
  mingler: 'mingler',
  interestTableTopic: 'interestTable',
}

// The list API's independent per-column search parameters (CR-62), AND-combined
// server-side. Order is irrelevant to the API; it fixes iteration order only.
export const FINANCE_SEARCH_FIELDS = Object.values(
  FINANCE_SEARCH_FIELD_BY_COLUMN_KEY,
) as FinanceSearchField[]

// Each term is truncated server-side; mirror it so the UI and the request agree.
export const FINANCE_SEARCH_TERM_MAX_LENGTH = 100

// Maps a finance table column key to the `sortBy` value the list API accepts for it.
export const FINANCE_SORT_FIELD_BY_COLUMN_KEY: Record<string, FinanceSortField> = {
  ...FINANCE_SEARCH_FIELD_BY_COLUMN_KEY,
  date: 'date',
  totalAmount: 'total',
}

export const PERIOD_TABS: PeriodTab[] = [
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_6_months', label: 'Last 6 Months' },
  { key: 'last_1_year', label: 'Last 1 Year' },
  { key: 'all_time', label: 'All Time' },
]
