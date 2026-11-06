import { describe, it, expect } from 'vitest'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import {
  EM_DASH,
  buildInterestTableDetailPath,
  buildMasterListParams,
  decodeRestaurantFilter,
  encodeRestaurantFilter,
  formatMasterListDateTime,
  getProminglerId,
  getProminglerName,
  hasActiveMasterListFilter,
} from '../masterListHelpers'
import type { MasterInterestTableItem } from '../types'

const SELF_CAPTAIN = 'Self Captain'

const sorter = (
  columnKey?: string,
  order?: 'ascend' | 'descend',
): SorterResult<MasterInterestTableItem> =>
  ({ columnKey, order }) as SorterResult<MasterInterestTableItem>

const noFilters: Record<string, FilterValue | null> = {}

describe('getProminglerName', () => {
  it('falls back to the Self Captain label when null or undefined', () => {
    expect(getProminglerName(null, SELF_CAPTAIN)).toBe(SELF_CAPTAIN)
    expect(getProminglerName(undefined, SELF_CAPTAIN)).toBe(SELF_CAPTAIN)
  })

  it('returns the bare name string the API sends today', () => {
    expect(getProminglerName('Laiba Hassan', SELF_CAPTAIN)).toBe('Laiba Hassan')
  })

  it('returns the object name once the API upgrades the shape', () => {
    expect(getProminglerName({ id: 'm1', name: 'Laiba Hassan' }, SELF_CAPTAIN)).toBe('Laiba Hassan')
  })

  it('treats an empty name as no promingler', () => {
    expect(getProminglerName('', SELF_CAPTAIN)).toBe(SELF_CAPTAIN)
    expect(getProminglerName({ id: 'm1', name: '' }, SELF_CAPTAIN)).toBe(SELF_CAPTAIN)
  })
})

describe('getProminglerId', () => {
  it('is undefined for null, undefined and the bare-string shape', () => {
    expect(getProminglerId(null)).toBeUndefined()
    expect(getProminglerId(undefined)).toBeUndefined()
    expect(getProminglerId('Laiba Hassan')).toBeUndefined()
  })

  it('returns the id from the object shape', () => {
    expect(getProminglerId({ id: 'm1', name: 'Laiba Hassan' })).toBe('m1')
  })

  it('is undefined when the object carries an empty id', () => {
    expect(getProminglerId({ id: '', name: 'Laiba Hassan' })).toBeUndefined()
  })
})

describe('formatMasterListDateTime', () => {
  it('formats the pre-formatted DD-MM-YYYY + HH:MM pair', () => {
    expect(formatMasterListDateTime('12-07-2026', '20:00')).toBe('12-07-2026 · 8:00 PM')
  })

  it('defaults the time when only a date is present', () => {
    expect(formatMasterListDateTime('12-07-2026')).toBe('12-07-2026 · 12:00 AM')
  })

  it('returns a dash for a missing or unparseable date', () => {
    expect(formatMasterListDateTime()).toBe(EM_DASH)
    expect(formatMasterListDateTime('')).toBe(EM_DASH)
    expect(formatMasterListDateTime('not-a-date', '20:00')).toBe(EM_DASH)
  })
})

describe('buildInterestTableDetailPath', () => {
  it('uses the unscoped route so the detail page Back returns to the global list', () => {
    expect(buildInterestTableDetailPath('it1')).toBe('/interest-tables/it1?tab=overview')
  })

  it('appends extra query parameters', () => {
    expect(buildInterestTableDetailPath('it1', '&edit=1')).toBe(
      '/interest-tables/it1?tab=overview&edit=1',
    )
  })
})

describe('encode/decodeRestaurantFilter', () => {
  it('round-trips a search term and selected ids', () => {
    const encoded = encodeRestaurantFilter('Aurelia', ['r1', 'r2'])
    expect(encoded).toEqual(['q:Aurelia', 'id:r1', 'id:r2'])
    expect(decodeRestaurantFilter(encoded)).toEqual({
      search: 'Aurelia',
      restaurantIds: ['r1', 'r2'],
    })
  })

  it('omits an empty search term', () => {
    expect(encodeRestaurantFilter('', ['r1'])).toEqual(['id:r1'])
  })

  it('decodes null and undefined to empty values', () => {
    expect(decodeRestaurantFilter(null)).toEqual({ search: '', restaurantIds: [] })
    expect(decodeRestaurantFilter(undefined)).toEqual({ search: '', restaurantIds: [] })
  })

  it('ignores unrecognised keys', () => {
    expect(decodeRestaurantFilter(['junk'])).toEqual({ search: '', restaurantIds: [] })
  })
})

describe('buildMasterListParams', () => {
  it('returns every key as undefined when nothing is set', () => {
    expect(buildMasterListParams(noFilters, sorter())).toEqual({
      search: undefined,
      searchField: undefined,
      sortBy: undefined,
      sortOrder: undefined,
      availabilityMode: undefined,
      status: undefined,
      restaurantId: undefined,
      inviteOnly: undefined,
    })
  })

  it('maps the Interest Table magnifier to searchField=interestTable', () => {
    const result = buildMasterListParams({ name: ['tasting'] }, sorter())
    expect(result.search).toBe('tasting')
    expect(result.searchField).toBe('interestTable')
  })

  it('maps the Restaurant column search to searchField=restaurant', () => {
    const result = buildMasterListParams({ restaurant: ['q:Aurelia'] }, sorter())
    expect(result.search).toBe('Aurelia')
    expect(result.searchField).toBe('restaurant')
  })

  it('lets the Interest Table magnifier win when both are somehow set', () => {
    const result = buildMasterListParams({ name: ['tasting'], restaurant: ['q:Aurelia'] }, sorter())
    expect(result.searchField).toBe('interestTable')
  })

  it('extracts restaurantId[] from the Restaurant column filter', () => {
    const result = buildMasterListParams({ restaurant: ['id:r1', 'id:r2'] }, sorter())
    expect(result.restaurantId).toEqual(['r1', 'r2'])
    expect(result.search).toBeUndefined()
  })

  it('maps multi-select availability and status filters', () => {
    const result = buildMasterListParams(
      { availabilityMode: ['AVAILABLE_NOW'], status: ['PENDING', 'CONFIRMED'] },
      sorter(),
    )
    expect(result.availabilityMode).toEqual(['AVAILABLE_NOW'])
    expect(result.status).toEqual(['PENDING', 'CONFIRMED'])
  })

  it('maps the invite-only yes/no filter to a boolean', () => {
    expect(buildMasterListParams({ inviteOnly: ['yes'] }, sorter()).inviteOnly).toBe(true)
    expect(buildMasterListParams({ inviteOnly: ['no'] }, sorter()).inviteOnly).toBe(false)
    expect(buildMasterListParams({ inviteOnly: [] }, sorter()).inviteOnly).toBeUndefined()
  })

  it.each([
    ['name', 'interestTable'],
    ['restaurant', 'restaurant'],
    ['dateTime', 'dateTime'],
    ['maxGuests', 'maxGuests'],
  ])('maps the %s column to sortBy=%s', (columnKey, expected) => {
    const result = buildMasterListParams(noFilters, sorter(columnKey, 'ascend'))
    expect(result.sortBy).toBe(expected)
    expect(result.sortOrder).toBe('asc')
  })

  it('maps a descending sort', () => {
    const result = buildMasterListParams(noFilters, sorter('dateTime', 'descend'))
    expect(result.sortOrder).toBe('desc')
  })

  it('clears the sort when AntD reports no order', () => {
    const result = buildMasterListParams(noFilters, sorter('dateTime', undefined))
    expect(result.sortBy).toBeUndefined()
    expect(result.sortOrder).toBeUndefined()
  })

  it('ignores a sort on a non-sortable column', () => {
    const result = buildMasterListParams(noFilters, sorter('promingler', 'ascend'))
    expect(result.sortBy).toBeUndefined()
    expect(result.sortOrder).toBeUndefined()
  })

  it('reads the first entry when AntD hands back an array of sorters', () => {
    const result = buildMasterListParams(noFilters, [sorter('name', 'descend')])
    expect(result.sortBy).toBe('interestTable')
    expect(result.sortOrder).toBe('desc')
  })
})

describe('hasActiveMasterListFilter', () => {
  it('is false for paging and sorting alone', () => {
    expect(
      hasActiveMasterListFilter({ page: 2, pageSize: 25, sortBy: 'dateTime', sortOrder: 'desc' }),
    ).toBe(false)
  })

  it.each([
    ['search', { search: 'a' }],
    ['availabilityMode', { availabilityMode: ['AVAILABLE_NOW' as const] }],
    ['status', { status: ['PENDING' as const] }],
    ['restaurantId', { restaurantId: ['r1'] }],
    ['inviteOnly', { inviteOnly: false }],
  ])('is true when %s is set', (_label, params) => {
    expect(hasActiveMasterListFilter(params)).toBe(true)
  })
})
