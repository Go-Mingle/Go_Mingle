import type { FINANCES_PERIODS, FINANCES_SEARCH_FIELDS, FINANCES_SORT_FIELDS } from './constants'

export type FinancesSortBy = (typeof FINANCES_SORT_FIELDS)[number]
export type FinancesSearchField = (typeof FINANCES_SEARCH_FIELDS)[number]
export type FinancesPeriod = (typeof FINANCES_PERIODS)[number]
export type FinancesSortOrder = 'asc' | 'desc'

/** A named record the grid links out to — Mingler (PP6) or interest table (PP5). */
export interface FinanceLinkedEntity {
  id: string
  name: string
}

/**
 * One ledger row (BR-01 — `COMPLETED` bookings only).
 *
 * Six display fields, exactly as designed. `gomingleSharePkr` and the loyalty
 * pair are deliberately absent: they are detail-only, and the GoMingle share
 * must not be derived from the two numbers here — loyalty is part of the total,
 * so the subtraction would be wrong.
 */
export interface FinanceLedgerRow {
  /** Backs the row-click detail fetch. */
  bookingId: string
  /** The human reference shown in the Booking ID column. */
  bookingRef: string
  mingler: FinanceLinkedEntity
  interestTable: FinanceLinkedEntity
  /**
   * The **event date** — when the sitting actually took place — not when the
   * booking was made. `dateFrom`/`dateTo` filter on this same field, and sorting
   * by it orders by event date then by start time, so same-day sittings come back
   * in time-of-day order.
   *
   * A consequence worth knowing: these dates will not match the Admin Finances
   * screen for the same booking. That is intentional, and it compounds the
   * inclusion difference — the partner ledger is COMPLETED-only (BR-01) while
   * Admin lists confirmed commitments.
   *
   * Format is `YYYY-MM-DD` in Asia/Karachi, unlike the rest of the portal's
   * `DD-MM-YYYY HH:MM`. Rendered as received; never passed through a shared date
   * helper that assumes the other format (BR-09).
   */
  date: string
  /** Raw numbers. The client adds the PKR prefix and thousands separators (BR-13). */
  totalAmountPkr: number
  mySharePkr: number
}

export interface FinancesPagination {
  page: number
  pageSize: number
  totalRecords: number
  totalPages: number
}

export interface FinanceLedgerPage {
  items: FinanceLedgerRow[]
  pagination: FinancesPagination
}

/**
 * The transaction-detail modal (BR-11).
 *
 * Note the field set: it includes `restaurantName` — redundant in a
 * single-restaurant portal, but the design shows it — and excludes the interest
 * table, which appears in the grid but not here.
 */
export interface FinanceTransactionDetail {
  bookingRef: string
  restaurantName: string
  mingler: FinanceLinkedEntity
  date: string
  mySharePkr: number
  gomingleSharePkr: number
  loyaltyDeductionPkr: number
  loyaltyDeductionPoints: number
  totalAmountPkr: number
}

/**
 * Ledger query params.
 *
 * Unlike the J3 users grid and the J4 deliveries log — which quietly fall back
 * to defaults — a bad value here is a **422**. Anything reaching this type must
 * have passed through `sanitiseLedgerParams` first.
 *
 * `period` and explicit dates are mutually exclusive: a preset alone, or
 * `dateFrom` + `dateTo` with no period. `CUSTOM` requires both dates.
 */
export interface FinancesLedgerParams {
  page?: number
  pageSize?: number
  sortBy?: FinancesSortBy
  sortOrder?: FinancesSortOrder
  searchField?: FinancesSearchField
  /** Ignored by the backend unless `searchField` is also set (BR-07). */
  search?: string
  period?: FinancesPeriod
  dateFrom?: string
  dateTo?: string
}

/** The export takes the same filters but rejects `page`/`pageSize` with a 422. */
export type FinancesExportParams = Omit<FinancesLedgerParams, 'page' | 'pageSize'>
