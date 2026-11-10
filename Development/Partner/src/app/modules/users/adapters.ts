import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import type {
  PartnerUserListItem,
  PartnerUserStatus,
  PartnerUsersQueryParams,
  PartnerUsersSearchField,
  PartnerUsersSortBy,
  UserRow,
} from './types'

/**
 * Translates the J3 API vocabulary into the shape the existing Users UI reads.
 *
 * The screen predates the API and is being preserved as-is, so the mapping lives
 * here rather than as renames across the table, the cards and three modals:
 * `fullName` → `name`, `lastActiveAt` → `lastActive`, and `ACTIVE`/`SUSPENDED` →
 * the lowercase values the components already compare against.
 */

/** Two-letter monogram for the row avatar, e.g. "Yasmeen Iqbal" → "YI". */
export function initialsOf(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function toUserRow(item: PartnerUserListItem): UserRow {
  return {
    id: item.id,
    name: item.fullName,
    // null and '' both mean "not set"; the UI renders an em dash for undefined.
    designation: item.designation ?? undefined,
    status: item.status === 'SUSPENDED' ? 'suspended' : 'active',
    lastActive: item.lastActiveAt ?? undefined,
    initials: initialsOf(item.fullName),
    isPrimary: item.isPrimary,
    canSuspend: item.canSuspend,
    canDelete: item.canDelete,
    email: item.email,
  }
}

export function toUserRows(items: PartnerUserListItem[]): UserRow[] {
  return items.map(toUserRow)
}

/** `'active'` → `'ACTIVE'`, for sending a UI status value back to the API. */
export function toApiStatus(status: string): 'ACTIVE' | 'SUSPENDED' {
  return String(status).toLowerCase() === 'suspended' ? 'SUSPENDED' : 'ACTIVE'
}

/**
 * Serialises grid params, omitting anything unset so the backend applies its own
 * defaults. `status` repeats the key rather than sending CSV — both are accepted
 * and repetition survives values containing a comma.
 */
export function buildUsersQueryString(params: PartnerUsersQueryParams): string {
  const search = new URLSearchParams()

  if (params.page !== undefined) search.set('page', String(params.page))
  if (params.pageSize !== undefined) search.set('pageSize', String(params.pageSize))
  if (params.sortBy) search.set('sortBy', params.sortBy)
  if (params.sortOrder) search.set('sortOrder', params.sortOrder)
  if (params.search?.trim()) search.set('search', params.search.trim())
  if (params.searchField) search.set('searchField', params.searchField)
  params.status?.forEach((value) => search.append('status', value))
  if (params.lastActiveFrom) search.set('lastActiveFrom', params.lastActiveFrom)
  if (params.lastActiveTo) search.set('lastActiveTo', params.lastActiveTo)

  const query = search.toString()
  return query ? `?${query}` : ''
}

/**
 * True when the grid params narrow the result set — a column search, a status
 * filter, or a date range.
 *
 * Sorting is deliberately excluded: it reorders, it never removes, so an empty
 * grid under a sort alone is still "this restaurant has no other users". That
 * distinction is the whole point — the two empty states carry different advice
 * (MET-1307 / TC-PARTNER-USERS-012c).
 */
export function hasNarrowingFilters(params: PartnerUsersQueryParams): boolean {
  return Boolean(
    params.search?.trim() || params.status?.length || params.lastActiveFrom || params.lastActiveTo,
  )
}

// ── AntD table state → grid params ────────────────────────────
const SORT_KEYS: Record<string, PartnerUsersSortBy> = {
  name: 'name',
  designation: 'designation',
  lastActive: 'lastActive',
  status: 'status',
}

/** AntD's single-column search dropdowns hand back a one-element array. */
function firstString(value: FilterValue | null | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value
  return typeof candidate === 'string' && candidate.trim() ? candidate : undefined
}

/**
 * A half-open range is dropped rather than sent: the date bounds are the only
 * params the backend really does 400 on.
 */
function toDateBounds(value: FilterValue | null | undefined): PartnerUsersQueryParams {
  const range = (Array.isArray(value) ? value[0] : value) as
    | [Dayjs | null, Dayjs | null]
    | undefined
  if (!Array.isArray(range) || !range[0] || !range[1]) return {}
  return {
    lastActiveFrom: dayjs(range[0]).format('YYYY-MM-DD'),
    lastActiveTo: dayjs(range[1]).format('YYYY-MM-DD'),
  }
}

/**
 * Converts an AntD `onChange` payload into grid params.
 *
 * Lives here rather than in the table component so the mapping is unit-testable
 * without mounting a table, and so the component file exports only components.
 */
export function toListParams(
  filters: Record<string, FilterValue | null>,
  sorter: SorterResult<UserRow> | SorterResult<UserRow>[],
): PartnerUsersQueryParams {
  const active = Array.isArray(sorter) ? sorter[0] : sorter
  const sortBy = SORT_KEYS[String(active?.columnKey ?? '')]
  const params: PartnerUsersQueryParams = {}

  if (sortBy && active?.order) {
    params.sortBy = sortBy
    params.sortOrder = active.order === 'ascend' ? 'asc' : 'desc'
  }

  // Only one search box is ever active in this UI; name wins if both carry a
  // value, and omitting `searchField` would search both columns.
  const nameSearch = firstString(filters.name)
  const designationSearch = firstString(filters.designation)
  const search = nameSearch ?? designationSearch
  if (search) {
    params.search = search
    params.searchField = (nameSearch ? 'name' : 'designation') satisfies PartnerUsersSearchField
  }

  const statuses = (filters.status ?? []) as string[]
  if (statuses.length > 0) {
    params.status = statuses.map(
      (value) => (value === 'suspended' ? 'SUSPENDED' : 'ACTIVE') satisfies PartnerUserStatus,
    )
  }

  return { ...params, ...toDateBounds(filters.lastActive) }
}
