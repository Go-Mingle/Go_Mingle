import type { InterestTableSearchField, InterestTableSortField } from './types'

export const INTEREST_TABLE_ENDPOINTS = {
  /** Cross-restaurant master list (CR-43). */
  listAll: '/api/v1/interest-tables',
  listByRestaurant: (rid: string) => `/api/v1/restaurants/${rid}/interest-tables`,
  create: (rid: string) => `/api/v1/restaurants/${rid}/interest-tables`,
  detail: (id: string) => `/api/v1/interest-tables/${id}`,
  update: (id: string) => `/api/v1/interest-tables/${id}`,
  remove: (id: string) => `/api/v1/interest-tables/${id}`,
  makeAvailable: (id: string) => `/api/v1/interest-tables/${id}/make-available`,
  publish: (id: string) => `/api/v1/interest-tables/${id}/publish`,
  cancel: (id: string) => `/api/v1/interest-tables/${id}/cancel`,
  promingler: (id: string) => `/api/v1/interest-tables/${id}/promingler`,
  activeProminglers: '/api/v1/minglers/prominglers/active',
  minglersLookup: '/api/v1/minglers',
  invitees: (id: string) => `/api/v1/interest-tables/${id}/invitees`,
  inviteeById: (id: string, minglerId: string) =>
    `/api/v1/interest-tables/${id}/invitees/${minglerId}`,
  menuOptions: (id: string) => `/api/v1/interest-tables/${id}/menu-options`,
  availabilityCheck: (rid: string, tid: string) =>
    `/api/v1/restaurants/${rid}/tables/${tid}/availability-check`,
} as const

export const INTEREST_TABLE_STATUS_COLORS: Record<string, string> = {
  PENDING: 'gold',
  CONFIRMED: 'green',
  COMPLETED: 'blue',
  CANCELLED: 'red',
  DRAFT: 'default',
  COMING_SOON: 'purple',
}

// [MET-1296] The V7 seat range (MAX/MIN_MINGLERS 6/3) and duration range
// (MAX/MIN_DURATION_HOURS 4/1) are gone. V8 replaced them with Max Guests 4–8
// (GUEST_OPTIONS) and the five fixed durations (DURATION_HOUR_OPTIONS) — both
// live in CreateInterestTableModal, the only surface that inputs them. These
// four constants had no consumers left and only kept the retired 4-hour
// maximum discoverable in the codebase.
export const MAX_MENU_OPTIONS = 3
export const MIN_MENU_OPTIONS = 1
export const PAGE_SIZES = [10, 25, 50] as const
export const DEFAULT_PAGE_SIZE = 10

/**
 * The master-list API defaults to 25, but every other grid in the portal starts
 * at 10, so we send 10 explicitly to keep paging consistent across the app.
 */
export const MASTER_LIST_DEFAULT_PAGE_SIZE = 10

/**
 * Master-list column key → API `searchField`. Only these two columns carry a
 * magnifier; whichever one holds a value determines `search` + `searchField`.
 */
export const IT_SEARCH_FIELD_BY_COLUMN_KEY: Record<string, InterestTableSearchField> = {
  name: 'interestTable',
  restaurant: 'restaurant',
}

/** Master-list column key → API `sortBy`. */
export const IT_SORT_FIELD_BY_COLUMN_KEY: Record<string, InterestTableSortField> = {
  name: 'interestTable',
  restaurant: 'restaurant',
  dateTime: 'dateTime',
  maxGuests: 'maxGuests',
}
