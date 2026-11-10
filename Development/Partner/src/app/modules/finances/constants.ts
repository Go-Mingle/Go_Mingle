/**
 * J5 Finances (Partner Portal) — a read-only ledger of completed-booking
 * earnings. Restaurant scope comes from the access token (F1 BR-04); there is
 * no `restaurantId` param on any route and sending one is a 422.
 */
export const FINANCES_ENDPOINTS = {
  ledger: '/api/v1/partner/finances',
  export: '/api/v1/partner/finances/export',
  detail: (bookingId: string) => `/api/v1/partner/finances/${bookingId}`,
  escrow: '/api/v1/partner/escrow',
} as const

export const FINANCES_LEDGER_QUERY_KEY = ['partner', 'finances', 'ledger'] as const
export const FINANCES_ESCROW_QUERY_KEY = ['partner', 'finances', 'escrow'] as const
export const FINANCES_DETAIL_QUERY_KEY = ['partner', 'finances', 'detail'] as const

/** BR-08 — page size ∈ {10, 25, 50}, default 10. */
export const FINANCES_PAGE_SIZES = [10, 25, 50] as const
export const FINANCES_DEFAULT_PAGE_SIZE = 10

/**
 * BR-06 — sortable columns. The two money columns are deliberately absent: they
 * carry no sort affordance in the design, and sending them is a 422.
 */
export const FINANCES_SORT_FIELDS = ['bookingRef', 'mingler', 'interestTable', 'date'] as const

/** BR-07 — searchable columns. Date is range-filtered, not text-searched. */
export const FINANCES_SEARCH_FIELDS = ['bookingRef', 'mingler', 'interestTable'] as const

export const FINANCES_PERIODS = ['ALL_TIME', 'THIS_MONTH', 'THIS_YEAR', 'CUSTOM'] as const

export const FINANCES_DEFAULT_SORT_BY = 'date'
export const FINANCES_DEFAULT_SORT_ORDER = 'desc'
export const FINANCES_DEFAULT_PERIOD = 'ALL_TIME'
