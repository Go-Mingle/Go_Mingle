import { describe, it, expect } from 'vitest'
import {
  buildNotificationsQuery,
  hasActiveFilters,
  isDateRangeComplete,
  sanitiseNotificationsParams,
} from '../params'

describe('sanitiseNotificationsParams', () => {
  it('keeps a fully valid combination intact', () => {
    expect(
      sanitiseNotificationsParams({
        search: 'mixer',
        type: ['IT_CANCELLED', 'IT_CONFIRMED'],
        status: 'UNREAD',
        startDate: '2026-05-01',
        endDate: '2026-05-08',
        sortDir: 'asc',
        page: 2,
        pageSize: 50,
      }),
    ).toEqual({
      search: 'mixer',
      type: ['IT_CANCELLED', 'IT_CONFIRMED'],
      status: 'UNREAD',
      startDate: '2026-05-01',
      endDate: '2026-05-08',
      sortDir: 'asc',
      page: 2,
      pageSize: 50,
    })
  })

  it('returns an empty object for no params', () => {
    expect(sanitiseNotificationsParams()).toEqual({})
  })

  /**
   * Dropping matters more here than on J6G's reviews list: that endpoint ignores a bad
   * param, this one 422s. A stale value reaching the wire would blank the screen.
   */
  it.each([
    ['an unknown status', { status: 'ARCHIVED' }],
    ['a lowercase status', { status: 'unread' }],
    ['an unknown sort direction', { sortDir: 'sideways' }],
    ['a page size the endpoint refuses', { pageSize: 100 }],
    ['a non-numeric page size', { pageSize: 'twenty' }],
    ['page zero', { page: 0 }],
    ['a negative page', { page: -3 }],
    ['a fractional page', { page: 1.5 }],
    ['a blank search', { search: '   ' }],
    ['a non-string search', { search: 42 }],
  ])('drops %s', (_label, raw) => {
    expect(sanitiseNotificationsParams(raw as never)).toEqual({})
  })

  it.each([10, 25, 50])('keeps the accepted page size %i', (pageSize) => {
    expect(sanitiseNotificationsParams({ pageSize })).toEqual({ pageSize })
  })

  it.each(['ALL', 'UNREAD', 'READ'] as const)('keeps the %s status', (status) => {
    expect(sanitiseNotificationsParams({ status })).toEqual({ status })
  })

  it('trims the search term', () => {
    expect(sanitiseNotificationsParams({ search: '  startup mixer  ' })).toEqual({
      search: 'startup mixer',
    })
  })

  /** The API caps at 255; truncating beats being rejected for one character. */
  it('truncates a search term at 255 characters', () => {
    const result = sanitiseNotificationsParams({ search: 'a'.repeat(300) })
    expect(result.search).toHaveLength(255)
  })
})

describe('sanitiseNotificationsParams — the type filter', () => {
  it('keeps the keys in the order given', () => {
    expect(
      sanitiseNotificationsParams({ type: ['IT_CREATED', 'PROMINGLER_UPDATED'] }).type,
    ).toEqual(['IT_CREATED', 'PROMINGLER_UPDATED'])
  })

  it('de-duplicates so a key is never sent twice', () => {
    expect(sanitiseNotificationsParams({ type: ['IT_CREATED', 'IT_CREATED'] }).type).toEqual([
      'IT_CREATED',
    ])
  })

  it('drops blanks and non-strings individually', () => {
    expect(
      sanitiseNotificationsParams({ type: ['IT_CREATED', '', '  ', 7, null] as never }).type,
    ).toEqual(['IT_CREATED'])
  })

  /** Omitted rather than sent empty — an empty key would read as "match nothing". */
  it.each([
    ['an empty array', []],
    ['an array of only blanks', ['', '  ']],
    ['a bare string', 'IT_CREATED'],
    ['null', null],
  ])('omits the key for %s', (_label, type) => {
    expect(sanitiseNotificationsParams({ type } as never).type).toBeUndefined()
  })

  /**
   * There is deliberately no allow-list check: the catalogue is fetched at runtime, and
   * the UI only ever offers keys it came back with.
   */
  it('does not second-guess the catalogue', () => {
    expect(sanitiseNotificationsParams({ type: ['SOMETHING_NEW'] }).type).toEqual(['SOMETHING_NEW'])
  })
})

describe('isDateRangeComplete', () => {
  it('is true only with both valid dates', () => {
    expect(isDateRangeComplete('2026-05-01', '2026-05-08')).toBe(true)
  })

  it.each([
    ['only a start', '2026-05-01', undefined],
    ['only an end', undefined, '2026-05-08'],
    ['neither', undefined, undefined],
    ['a malformed start', '01-05-2026', '2026-05-08'],
    ['a malformed end', '2026-05-01', 'May 8'],
    ['empty strings', '', ''],
  ])('is false for %s', (_label, start, end) => {
    expect(isDateRangeComplete(start, end)).toBe(false)
  })
})

describe('sanitiseNotificationsParams — the date range', () => {
  /** One date alone is a 400, so a half-set range never reaches the wire. */
  it.each([
    ['only a start date', { startDate: '2026-05-01' }],
    ['only an end date', { endDate: '2026-05-08' }],
  ])('drops %s entirely', (_label, raw) => {
    const result = sanitiseNotificationsParams(raw)

    expect(result.startDate).toBeUndefined()
    expect(result.endDate).toBeUndefined()
  })

  it('keeps a complete range', () => {
    expect(sanitiseNotificationsParams({ startDate: '2026-05-01', endDate: '2026-05-08' })).toEqual(
      {
        startDate: '2026-05-01',
        endDate: '2026-05-08',
      },
    )
  })

  it('drops a range where either end is malformed', () => {
    expect(
      sanitiseNotificationsParams({ startDate: '08-05-2026', endDate: '2026-05-08' }).startDate,
    ).toBeUndefined()
  })

  /**
   * An inverted range is the server's to reject (`ERR_DATE_RANGE_INVALID`) — the picker
   * prevents it, and the client does not silently reorder what the user chose.
   */
  it('passes an inverted range through rather than reordering it', () => {
    expect(sanitiseNotificationsParams({ startDate: '2026-05-08', endDate: '2026-05-01' })).toEqual(
      { startDate: '2026-05-08', endDate: '2026-05-01' },
    )
  })
})

describe('buildNotificationsQuery', () => {
  it('returns an empty string with no params', () => {
    expect(buildNotificationsQuery({})).toBe('')
  })

  it('builds every param in a stable order', () => {
    expect(
      buildNotificationsQuery({
        search: 'mixer',
        type: ['IT_CREATED'],
        status: 'UNREAD',
        startDate: '2026-05-01',
        endDate: '2026-05-08',
        sortDir: 'desc',
        page: 1,
        pageSize: 25,
      }),
    ).toBe(
      '?search=mixer&type=IT_CREATED&status=UNREAD&startDate=2026-05-01&endDate=2026-05-08&sortDir=desc&page=1&pageSize=25',
    )
  })

  /** Repeated keys, not CSV — the J3 convention. */
  it('repeats the type key rather than joining with commas', () => {
    const query = buildNotificationsQuery({ type: ['IT_CREATED', 'IT_CANCELLED'] })

    expect(new URLSearchParams(query.slice(1)).getAll('type')).toEqual([
      'IT_CREATED',
      'IT_CANCELLED',
    ])
    expect(query).not.toContain('IT_CREATED,')
  })

  it('encodes a search term with spaces and punctuation', () => {
    const query = buildNotificationsQuery({ search: 'startup mixer & friends' })
    expect(new URLSearchParams(query.slice(1)).get('search')).toBe('startup mixer & friends')
  })

  it('omits absent params rather than sending them empty', () => {
    const query = buildNotificationsQuery({ page: 3 })

    expect(query).toBe('?page=3')
    expect(query).not.toContain('search')
    expect(query).not.toContain('type')
  })

  /** The service sanitises before building, so the pair must compose cleanly. */
  it('composes with the sanitiser', () => {
    const raw = { status: 'nonsense', pageSize: 100, type: ['IT_CREATED'], page: 2 }
    expect(buildNotificationsQuery(sanitiseNotificationsParams(raw as never))).toBe(
      '?type=IT_CREATED&page=2',
    )
  })
})

describe('hasActiveFilters', () => {
  /**
   * Drives which of the two full-screen empty states to show: the API returns the same
   * empty `items` whether the inbox is empty or the filters matched nothing.
   */
  it('is false for an untouched screen', () => {
    expect(hasActiveFilters({})).toBe(false)
  })

  it.each([
    ['a search', { search: 'mixer' }],
    ['a type filter', { type: ['IT_CREATED'] }],
    ['an unread filter', { status: 'UNREAD' as const }],
    ['a read filter', { status: 'READ' as const }],
    ['a date range', { startDate: '2026-05-01', endDate: '2026-05-08' }],
  ])('is true for %s', (_label, params) => {
    expect(hasActiveFilters(params)).toBe(true)
  })

  /** Neither is a filter — they are the absence of one. */
  it.each([
    ['the ALL status', { status: 'ALL' as const }],
    ['the default sort', { sortDir: 'desc' as const }],
    ['paging alone', { page: 3, pageSize: 25 }],
  ])('is false for %s', (_label, params) => {
    expect(hasActiveFilters(params)).toBe(false)
  })

  it('is false for a half-set date range, which never reaches the wire', () => {
    expect(hasActiveFilters({ startDate: '2026-05-01' })).toBe(false)
  })
})
