/**
 * J6E Restaurant Profile — Table Timings (Partner Portal).
 *
 * Five client-callable endpoints over `restaurant_tables` + `table_availability`
 * (both J10A-owned; J6E is the partner write layer and migrates nothing).
 *
 * No restaurant id appears on any route — it is resolved from the access token
 * (F1 BR-04), and J6E accepts none from the client, same as J6A–J6D.
 */
const ROOT = '/api/v1/partner/restaurant'

export const PARTNER_TABLES_ENDPOINTS = {
  tables: `${ROOT}/tables`,
  tableById: (tableId: string) => `${ROOT}/tables/${tableId}`,
  tableVisibility: (tableId: string) => `${ROOT}/tables/${tableId}/visibility`,
} as const

export const PARTNER_TABLES_QUERY_KEY = ['partner', 'restaurant', 'tables'] as const

/**
 * J6E-specific error codes (spec §4.3). Everything else on this tab is reused:
 * `ERR_PROFILE_READ_ONLY` from J6A and the F1 catalogue for the rest.
 */
export const TABLES_ERROR_CODES = {
  NAME_DUPLICATE: 'ERR_TABLE_NAME_DUPLICATE',
  IN_USE: 'ERR_TABLE_IN_USE',
} as const

/**
 * Form limits.
 *
 * `nameMax` is the spec's (§5). `rangesPerDayMax` is the backend's request guard —
 * not in the spec's rule table, but it asked explicitly that the form cap
 * "+ Add time range" at six so a partner never earns a 422 for it.
 */
export const TABLE_LIMITS = {
  nameMax: 150,
  rangesPerDayMax: 6,
} as const

/**
 * The wire's weekday keys: `"0"` = Sunday … `"6"` = Saturday.
 *
 * Only these seven are accepted — `"7"`, `"mon"` or anything else is a **422,
 * not silently ignored** — so every request body is built from this list rather
 * than from whatever the form happens to hold.
 */
export const WEEKDAY_KEYS = ['0', '1', '2', '3', '4', '5', '6'] as const

/**
 * The order the design lists the week in: Monday first, Sunday last.
 *
 * Deliberately separate from {@link WEEKDAY_KEYS}, which is the wire's
 * Sunday-first order. Display order must never leak into a request body.
 */
export const DISPLAY_DAY_ORDER = ['1', '2', '3', '4', '5', '6', '0'] as const
