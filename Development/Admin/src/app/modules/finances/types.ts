import type { RestaurantInfo } from './RestaurantInfoPopover'

// ── Raw list API shape (GET /api/v1/admin/finances) ─────────────
export interface FinanceListRestaurant {
  id: string
  name: string
  city: string | null
  address: string | null
  lat: number | null
  lng: number | null
  avatarUrl: string | null
}

export interface FinanceListMingler {
  id: string
  name: string
}

export interface FinanceListItem {
  bookingRef: string
  restaurant: FinanceListRestaurant
  mingler: FinanceListMingler
  interestTableName: string
  date: string
  eventStart: string
  eventEnd: string
  totalAmountPkr: number
  // Returned by the list endpoint (CR-42); kept optional as a defensive fallback
  // so a row missing them renders '—' rather than throwing.
  partnerSharePkr?: number
  gomingleSharePkr?: number
}

export interface FinancePaginationMeta {
  page: number
  pageSize: number
  totalRecords: number
  totalPages: number
}

export interface FinanceListResponse {
  items: FinanceListItem[]
  pagination: FinancePaginationMeta
}

// ── Table filters/sort/pagination accepted by GET /api/v1/admin/finances ──
// bookingRef/restaurant/mingler/interestTable: independent per-column search
//   terms, AND-combined server-side (CR-62). Each is trimmed and truncated to
//   100 chars. Superseded the single `q` + `searchField` pair, which could only
//   express one active column filter at a time (MET-753).
// dateFrom/dateTo: ISO date bounds (inclusive, on booked_at); dateFrom > dateTo → 400
// sortBy: omitted/invalid → service default (date desc)
export type FinanceSearchField = 'bookingRef' | 'restaurant' | 'mingler' | 'interestTable'
export type FinanceSortField =
  | 'bookingRef'
  | 'restaurant'
  | 'mingler'
  | 'interestTable'
  | 'date'
  | 'total'
export type FinanceSortOrder = 'asc' | 'desc'

/** Per-column search terms, keyed by the API's parameter name (CR-62). */
export type FinanceSearchTerms = Partial<Record<FinanceSearchField, string>>

export interface ListFinancesQueryParams extends FinanceSearchTerms {
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
  sortBy?: FinanceSortField
  sortOrder?: FinanceSortOrder
}

export interface FinanceListResult {
  items: FinanceRecord[]
  pagination: FinancePaginationMeta
}

// ── CSV export (GET /api/v1/admin/finances/export) ──────────────
// The endpoint returns a short-lived signed URL to the generated CSV rather
// than the file bytes; the client downloads from that URL.
export interface FinanceExportResult {
  url: string
  expiresIn: number
}

// ── Domain model consumed by the finances page/table/cards ──────
export interface FinanceRecord {
  id: string
  restaurant: string
  restaurantId: string
  bookingId: string
  mingler: string
  minglerId?: string
  interestTableTopic?: string
  totalAmount: number
  partnerShare?: number
  gomingleShare?: number
  date: string
  avatarColor?: string
  restaurantCity?: string
  restaurantAddress?: string
  restaurantInfo?: RestaurantInfo
}

export interface FinanceRecordDetail {
  bookingRef: string
  restaurant: string
  mingler: string
  interestTableName: string
  date: string
  eventStart: string
  eventEnd: string
  partnerSharePkr: number
  gomingleSharePkr: number
  loyaltyRedeemedPkr: number
  loyaltyRedeemedPoints: number
  // TODO(user): backend detail endpoint does not yet return this; wire when available.
  loyaltyPkrDeduction?: number
  totalAmountPkr: number
}

export interface PeriodTab {
  key: string
  label: string
}

export type FinancePeriod =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_6_months'
  | 'last_1_year'
  | 'all_time'
