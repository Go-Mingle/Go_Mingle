import type { WEEKDAY_KEYS } from './constants'

/** `"0"` = Sunday … `"6"` = Saturday. */
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number]

/**
 * One availability window, `HH:MM` 24-hour on the wire.
 *
 * Strictly zero-padded — `09:00`, never `9:00` — and same-day only: a range that
 * would cross midnight is rejected rather than wrapped (BR-06).
 */
export interface TimeRange {
  start: string
  end: string
}

/**
 * A table's weekly windows, keyed by weekday.
 *
 * All seven keys are always present on the read, so the week renders without
 * checking for missing ones. An **empty array means Closed** — there is no
 * separate `isOpen` flag, and a day is open exactly when it has ≥1 range (BR-04).
 */
export type TableAvailability = Record<WeekdayKey, TimeRange[]>

/** A table area as the list returns it. The key is `tableId`, not `id`. */
export interface PartnerTable {
  tableId: string
  name: string
  /**
   * Hidden tables stay in the list and are badged, never filtered out. The flag
   * withdraws the table from the admin's interest-table assigned-table picker
   * (CR-50); it does not hide anything from diners, who never browse tables at
   * all, and it does not detach the table from interest tables already assigned
   * to it — those keep running and stay bookable (BR-08).
   */
  isHidden: boolean
  availability: TableAvailability
}

/**
 * The create/edit body. Identical for POST and PATCH: **PATCH is a full replace**
 * of the whole week (BR-07), so the modal's complete seven-day state goes every
 * time. An omitted weekday means "the partner closed it", not "leave it alone".
 */
export interface TableDraft {
  name: string
  availability: TableAvailability
}

/**
 * The visibility response.
 *
 * Note the deliberate asymmetry, named in the spec and shared with J6D's menu
 * options: the **request** key is `hidden`, the **response** key is `isHidden`.
 */
export interface TableVisibilityResponse {
  tableId: string
  isHidden: boolean
}

export interface TableDeletedResponse {
  tableId: string
  deleted: boolean
}

/**
 * One weekday in the Add/Edit modal.
 *
 * `open` is editor-only state, derived from `availability[day].length > 0` on
 * load. It has to be held separately because a day toggled open before any time
 * is picked has zero ranges and must still render as open — the same state the
 * wire cannot distinguish from Closed.
 */
export interface DayDraft {
  open: boolean
  ranges: TimeRange[]
}

export type WeekDraft = Record<WeekdayKey, DayDraft>

/** The whole modal's state. */
export interface TableFormDraft {
  name: string
  days: WeekDraft
}
