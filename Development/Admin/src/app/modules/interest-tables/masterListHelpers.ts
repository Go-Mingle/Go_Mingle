import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import { IT_SEARCH_FIELD_BY_COLUMN_KEY, IT_SORT_FIELD_BY_COLUMN_KEY } from './constants'
import type {
  AvailabilityModeApi,
  InterestTableStatus,
  ListAllInterestTablesParams,
  MasterInterestTableItem,
  MasterProminglerRef,
} from './types'

dayjs.extend(customParseFormat)

/**
 * The master list sends `startDate` as "DD-MM-YYYY" and `startTime` as "HH:MM" —
 * pre-formatted strings, not ISO. dayjs must be told the source format or it
 * parses these as Invalid Date.
 */
const API_DATE_TIME_FORMAT = 'DD-MM-YYYY HH:mm'

export const EM_DASH = '—'

/** Prefix markers used to pack the Restaurant column's two filter kinds into AntD's flat `filteredValue`. */
export const RESTAURANT_SEARCH_PREFIX = 'q:'
export const RESTAURANT_ID_PREFIX = 'id:'

/**
 * The API sends the Promingler's name as a bare string (or null). It may later
 * send `{ id, name }`; both shapes resolve to a display name here.
 */
export function getProminglerName(
  promingler: MasterProminglerRef | null | undefined,
  selfCaptainLabel: string,
): string {
  if (promingler == null) return selfCaptainLabel
  if (typeof promingler === 'string') return promingler || selfCaptainLabel
  return promingler.name || selfCaptainLabel
}

/**
 * The mingler id needed to link the Promingler cell to its detail page.
 * `undefined` while the API still sends a bare name — the cell then renders as
 * plain text instead of a link.
 */
export function getProminglerId(
  promingler: MasterProminglerRef | null | undefined,
): string | undefined {
  if (promingler == null || typeof promingler === 'string') return undefined
  return promingler.id || undefined
}

/** Renders the pre-formatted date + time pair as "DD-MM-YYYY · h:mm A". */
export function formatMasterListDateTime(startDate?: string, startTime?: string): string {
  if (!startDate) return EM_DASH
  const parsed = dayjs(`${startDate} ${startTime ?? '00:00'}`, API_DATE_TIME_FORMAT)
  if (!parsed.isValid()) return EM_DASH
  return parsed.format('DD-MM-YYYY · h:mm A')
}

/**
 * Detail-page URL for a master-list row.
 *
 * Deliberately the unscoped `/interest-tables/:id` route rather than the
 * restaurant-scoped one: the detail page derives its Back target from whether
 * `:rid` is in the URL, so this is what returns the user to the global list they
 * came from. The page still resolves the restaurant it needs from the loaded
 * table (`table.restaurant.id`), so nothing downstream depends on the prefix.
 */
export function buildInterestTableDetailPath(id: string, extraQuery = ''): string {
  return `/interest-tables/${id}?tab=overview${extraQuery}`
}

/** Packs the Restaurant column's search term + selected ids into AntD's flat filter value. */
export function encodeRestaurantFilter(search: string, restaurantIds: string[]): string[] {
  const keys: string[] = []
  if (search) keys.push(`${RESTAURANT_SEARCH_PREFIX}${search}`)
  restaurantIds.forEach((id) => keys.push(`${RESTAURANT_ID_PREFIX}${id}`))
  return keys
}

/** Inverse of {@link encodeRestaurantFilter}. */
export function decodeRestaurantFilter(keys: readonly (React.Key | boolean)[] | null | undefined): {
  search: string
  restaurantIds: string[]
} {
  const search =
    keys
      ?.map(String)
      .find((key) => key.startsWith(RESTAURANT_SEARCH_PREFIX))
      ?.slice(RESTAURANT_SEARCH_PREFIX.length) ?? ''
  const restaurantIds =
    keys
      ?.map(String)
      .filter((key) => key.startsWith(RESTAURANT_ID_PREFIX))
      .map((key) => key.slice(RESTAURANT_ID_PREFIX.length)) ?? []
  return { search, restaurantIds }
}

/**
 * Maps an AntD table `onChange` payload to the master-list API params.
 *
 * `search` + `searchField` are derived from whichever magnifier holds a value —
 * only one column searches at a time, mirroring the Finances grid. Every
 * returned key is set explicitly (to `undefined` when cleared) so the caller can
 * merge the partial without stale filters lingering.
 */
export function buildMasterListParams(
  filters: Record<string, FilterValue | null>,
  sorter: SorterResult<MasterInterestTableItem> | SorterResult<MasterInterestTableItem>[],
): Partial<ListAllInterestTablesParams> {
  const restaurantFilter = decodeRestaurantFilter(filters.restaurant)

  let search: string | undefined
  let searchField: ListAllInterestTablesParams['searchField']
  for (const [columnKey, field] of Object.entries(IT_SEARCH_FIELD_BY_COLUMN_KEY)) {
    const value =
      columnKey === 'restaurant' ? restaurantFilter.search : (filters[columnKey]?.[0] ?? '')
    if (value) {
      search = String(value)
      searchField = field
      break
    }
  }

  const single = Array.isArray(sorter) ? sorter[0] : sorter
  const sortBy = single?.order ? IT_SORT_FIELD_BY_COLUMN_KEY[String(single.columnKey)] : undefined
  const sortOrder = sortBy ? (single.order === 'descend' ? 'desc' : 'asc') : undefined

  const inviteOnlyValue = filters.inviteOnly?.[0]

  return {
    search,
    searchField,
    sortBy,
    sortOrder,
    availabilityMode: filters.availabilityMode?.length
      ? (filters.availabilityMode.map(String) as AvailabilityModeApi[])
      : undefined,
    status: filters.status?.length
      ? (filters.status.map(String) as InterestTableStatus[])
      : undefined,
    restaurantId: restaurantFilter.restaurantIds.length
      ? restaurantFilter.restaurantIds
      : undefined,
    inviteOnly: inviteOnlyValue === undefined ? undefined : inviteOnlyValue === 'yes',
  }
}

/** True when any server-side filter or search is active — drives the empty-state copy. */
export function hasActiveMasterListFilter(params: ListAllInterestTablesParams): boolean {
  return Boolean(
    params.search ||
    params.availabilityMode?.length ||
    params.status?.length ||
    params.restaurantId?.length ||
    params.inviteOnly !== undefined,
  )
}
