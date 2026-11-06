import { describe, it, expect } from 'vitest'
import {
  buildFinancesQuery,
  hasNarrowingFilters,
  sanitiseLedgerParams,
  toExportParams,
} from '../financesParams'

/**
 * These endpoints 422 on a bad param, unlike the J3 users grid and J4 deliveries
 * log which silently default. The filter also lives in the URL so it survives
 * navigation — so a stale link is untrusted input, and every rejected value has
 * to be dropped rather than forwarded.
 */
describe('sanitiseLedgerParams — paging', () => {
  it('keeps a valid page and page size', () => {
    expect(sanitiseLedgerParams({ page: 3, pageSize: 25 })).toMatchObject({ page: 3, pageSize: 25 })
  })

  it('accepts numeric strings, as they arrive from the URL', () => {
    expect(sanitiseLedgerParams({ page: '2', pageSize: '50' })).toMatchObject({
      page: 2,
      pageSize: 50,
    })
  })

  it.each([0, -1, 1.5, 'abc', '', null, undefined])('drops the invalid page %p', (page) => {
    expect(sanitiseLedgerParams({ page }).page).toBeUndefined()
  })

  /** 20 is the kind of value a stale bookmark carries — it would 422. */
  it.each([20, 100, 0, 'ten'])('drops the unsupported page size %p', (pageSize) => {
    expect(sanitiseLedgerParams({ pageSize }).pageSize).toBeUndefined()
  })

  it.each([10, 25, 50])('accepts the supported page size %p', (pageSize) => {
    expect(sanitiseLedgerParams({ pageSize }).pageSize).toBe(pageSize)
  })
})

describe('sanitiseLedgerParams — sorting', () => {
  it.each(['bookingRef', 'mingler', 'interestTable', 'date'])('accepts sortBy %s', (sortBy) => {
    expect(sanitiseLedgerParams({ sortBy, sortOrder: 'asc' })).toMatchObject({ sortBy })
  })

  /** The money columns are not sortable — sending either is a 422. */
  it.each(['totalAmount', 'totalAmountPkr', 'mySharePkr', 'restaurant'])(
    'drops the unsortable field %s',
    (sortBy) => {
      expect(sanitiseLedgerParams({ sortBy }).sortBy).toBeUndefined()
    },
  )

  it('drops an invalid sort order', () => {
    expect(
      sanitiseLedgerParams({ sortBy: 'date', sortOrder: 'sideways' }).sortOrder,
    ).toBeUndefined()
  })

  it('keeps a valid sort order', () => {
    expect(sanitiseLedgerParams({ sortBy: 'date', sortOrder: 'desc' }).sortOrder).toBe('desc')
  })
})

describe('sanitiseLedgerParams — search', () => {
  it('keeps a term with its field', () => {
    expect(sanitiseLedgerParams({ searchField: 'mingler', search: 'Sana' })).toMatchObject({
      searchField: 'mingler',
      search: 'Sana',
    })
  })

  /** A term with no field is ignored server-side, so neither is sent alone. */
  it('drops a term with no field', () => {
    expect(sanitiseLedgerParams({ search: 'Sana' })).toEqual({})
  })

  it('drops a field with no term', () => {
    expect(sanitiseLedgerParams({ searchField: 'mingler' })).toEqual({})
  })

  it('drops a blank term', () => {
    expect(sanitiseLedgerParams({ searchField: 'mingler', search: '   ' })).toEqual({})
  })

  it('trims the term', () => {
    expect(sanitiseLedgerParams({ searchField: 'bookingRef', search: '  BK-1  ' }).search).toBe(
      'BK-1',
    )
  })

  it('drops an unsearchable field', () => {
    expect(sanitiseLedgerParams({ searchField: 'totalAmountPkr', search: '100' })).toEqual({})
  })
})

describe('sanitiseLedgerParams — date filter', () => {
  it('keeps a preset on its own', () => {
    expect(sanitiseLedgerParams({ period: 'THIS_MONTH' })).toEqual({ period: 'THIS_MONTH' })
  })

  it('keeps a complete explicit range and drops the preset', () => {
    expect(
      sanitiseLedgerParams({ period: 'THIS_YEAR', dateFrom: '2026-01-01', dateTo: '2026-06-30' }),
    ).toEqual({ dateFrom: '2026-01-01', dateTo: '2026-06-30' })
  })

  /** Sending a preset together with explicit dates is a 422. */
  it('never emits a preset and a range together', () => {
    const result = sanitiseLedgerParams({
      period: 'THIS_MONTH',
      dateFrom: '2026-01-01',
      dateTo: '2026-06-30',
    })
    expect(result.period).toBeUndefined()
    expect(result.dateFrom).toBe('2026-01-01')
  })

  /** CUSTOM without both dates is a 422, so it degrades to the default. */
  it('drops CUSTOM when the dates are missing', () => {
    expect(sanitiseLedgerParams({ period: 'CUSTOM' })).toEqual({})
    expect(sanitiseLedgerParams({ period: 'CUSTOM', dateFrom: '2026-01-01' })).toEqual({})
  })

  it('drops a half-open range', () => {
    expect(sanitiseLedgerParams({ dateFrom: '2026-01-01' })).toEqual({})
    expect(sanitiseLedgerParams({ dateTo: '2026-01-01' })).toEqual({})
  })

  it('drops an inverted range', () => {
    expect(sanitiseLedgerParams({ dateFrom: '2026-06-30', dateTo: '2026-01-01' })).toEqual({})
  })

  it('accepts a single-day range', () => {
    expect(sanitiseLedgerParams({ dateFrom: '2026-05-04', dateTo: '2026-05-04' })).toEqual({
      dateFrom: '2026-05-04',
      dateTo: '2026-05-04',
    })
  })

  it.each(['04-05-2026', '2026/05/04', '2026-5-4', 'yesterday', ''])(
    'drops the malformed date %p',
    (dateFrom) => {
      expect(sanitiseLedgerParams({ dateFrom, dateTo: '2026-06-30' })).toEqual({})
    },
  )

  /** Shape-valid but not a real day. */
  it('drops an impossible calendar date', () => {
    expect(sanitiseLedgerParams({ dateFrom: '2026-02-31', dateTo: '2026-03-01' })).toEqual({})
  })

  it('drops an unrecognised preset', () => {
    expect(sanitiseLedgerParams({ period: 'LAST_6_MONTHS' })).toEqual({})
  })
})

describe('sanitiseLedgerParams — defaults', () => {
  it('returns nothing for empty input, letting the backend apply its defaults', () => {
    expect(sanitiseLedgerParams()).toEqual({})
    expect(sanitiseLedgerParams({})).toEqual({})
  })

  it('drops every unrecognised value at once', () => {
    expect(
      sanitiseLedgerParams({
        page: 'x',
        pageSize: 20,
        sortBy: 'totalAmount',
        sortOrder: 'up',
        searchField: 'vat',
        search: 'anything',
        period: 'LAST_YEAR',
        dateFrom: 'nope',
      }),
    ).toEqual({})
  })
})

/**
 * Decides which empty state an empty ledger gets (MET-1301). Only params that
 * remove rows count — the no-match copy tells the partner to change a filter, so
 * offering it when there is none to change is worse than saying nothing.
 */
describe('hasNarrowingFilters', () => {
  it('is false for no params at all', () => {
    expect(hasNarrowingFilters({})).toBe(false)
  })

  it.each([
    ['a search term', { searchField: 'mingler' as const, search: 'Sana' }],
    ['a custom date range', { dateFrom: '2026-01-01', dateTo: '2026-06-30' }],
    ['a preset period', { period: 'THIS_MONTH' as const }],
  ])('is true for %s', (_label, params) => {
    expect(hasNarrowingFilters(params)).toBe(true)
  })

  it.each([
    ['a sort', { sortBy: 'mingler' as const, sortOrder: 'asc' as const }],
    ['a page', { page: 3, pageSize: 25 }],
    ['the default All Time period', { period: 'ALL_TIME' as const }],
  ])('is false for %s — it does not remove rows', (_label, params) => {
    expect(hasNarrowingFilters(params)).toBe(false)
  })

  it('is false for a blank search term', () => {
    expect(hasNarrowingFilters({ searchField: 'mingler', search: '   ' })).toBe(false)
  })

  /** A half-open range never reaches the API, so it is not a filter in effect. */
  it('is false for a half-open range', () => {
    expect(hasNarrowingFilters({ dateFrom: '2026-01-01' })).toBe(false)
    expect(hasNarrowingFilters({ dateTo: '2026-06-30' })).toBe(false)
  })
})

describe('toExportParams', () => {
  /** The export rejects pagination outright rather than ignoring it. */
  it('strips page and pageSize', () => {
    expect(toExportParams({ page: 2, pageSize: 50, period: 'THIS_YEAR', sortBy: 'date' })).toEqual({
      period: 'THIS_YEAR',
      sortBy: 'date',
    })
  })

  it('keeps the filters untouched', () => {
    expect(toExportParams({ searchField: 'mingler', search: 'Sana' })).toEqual({
      searchField: 'mingler',
      search: 'Sana',
    })
  })
})

describe('buildFinancesQuery', () => {
  it('returns an empty string when nothing is set', () => {
    expect(buildFinancesQuery({})).toBe('')
  })

  it('serialises paging and sorting', () => {
    expect(buildFinancesQuery({ page: 2, pageSize: 25, sortBy: 'date', sortOrder: 'desc' })).toBe(
      '?page=2&pageSize=25&sortBy=date&sortOrder=desc',
    )
  })

  it('serialises search and the date range', () => {
    expect(
      buildFinancesQuery({
        searchField: 'mingler',
        search: 'Sana Khan',
        dateFrom: '2026-01-01',
        dateTo: '2026-06-30',
      }),
    ).toBe('?searchField=mingler&search=Sana+Khan&dateFrom=2026-01-01&dateTo=2026-06-30')
  })

  it('never emits a restaurantId — scope comes from the token', () => {
    const query = buildFinancesQuery(
      sanitiseLedgerParams({ page: 1, restaurantId: 'r-1' } as Record<string, unknown>),
    )
    expect(query).not.toContain('restaurantId')
  })
})
