import { describe, it, expect } from 'vitest'
import { buildReviewsQuery, ratingsFromFilter, sanitiseReviewsParams } from '../params'
import type { ReviewsParams } from '../types'

describe('sanitiseReviewsParams', () => {
  it('keeps a fully valid combination intact', () => {
    expect(
      sanitiseReviewsParams({
        search: 'mezze',
        ratingFilter: [5, 4],
        sortBy: 'rating',
        sortOrder: 'asc',
        page: 2,
        pageSize: 25,
      }),
    ).toEqual({
      search: 'mezze',
      ratingFilter: [5, 4],
      sortBy: 'rating',
      sortOrder: 'asc',
      page: 2,
      pageSize: 25,
    })
  })

  it('returns an empty object for no params', () => {
    expect(sanitiseReviewsParams()).toEqual({})
  })

  /**
   * The endpoint never 422s — it clamps or ignores. So a dropped value here is not
   * about avoiding a rejection: it stops the UI claiming a sort or filter the server
   * never applied.
   */
  it.each([
    ['an unknown sort field', { sortBy: 'uploadedAt' }],
    ['an unknown order', { sortOrder: 'sideways' }],
    ['a page size the endpoint refuses', { pageSize: 100 }],
    ['a non-numeric page size', { pageSize: 'twenty' }],
    ['page zero', { page: 0 }],
    ['a negative page', { page: -3 }],
    ['a fractional page', { page: 1.5 }],
    ['a blank search', { search: '   ' }],
    ['a non-string search', { search: 42 }],
  ])('drops %s', (_label, raw) => {
    expect(sanitiseReviewsParams(raw as never)).toEqual({})
  })

  it('trims the search term', () => {
    expect(sanitiseReviewsParams({ search: '  branzino  ' })).toEqual({ search: 'branzino' })
  })

  it.each([10, 25, 50])('keeps the accepted page size %i', (pageSize) => {
    expect(sanitiseReviewsParams({ pageSize })).toEqual({ pageSize })
  })

  it.each(['date', 'rating'] as const)('keeps the %s sort field', (sortBy) => {
    expect(sanitiseReviewsParams({ sortBy })).toEqual({ sortBy })
  })

  /** Ordering without a field is meaningless, so it is never sent alone. */
  it('drops the order when no sort field accompanies it', () => {
    expect(sanitiseReviewsParams({ sortOrder: 'asc' })).toEqual({})
  })

  it('keeps the order alongside a field', () => {
    expect(sanitiseReviewsParams({ sortBy: 'date', sortOrder: 'asc' })).toEqual({
      sortBy: 'date',
      sortOrder: 'asc',
    })
  })
})

describe('sanitiseReviewsParams — the rating filter', () => {
  it('keeps every recognised rating, in the order given', () => {
    expect(sanitiseReviewsParams({ ratingFilter: [5, 1, 3] })).toEqual({ ratingFilter: [5, 1, 3] })
  })

  it('coerces numeric strings, because a filter control reports strings', () => {
    expect(sanitiseReviewsParams({ ratingFilter: ['5', '4'] as never })).toEqual({
      ratingFilter: [5, 4],
    })
  })

  /** One bad member must not discard the whole filter. */
  it('drops out-of-range members individually', () => {
    expect(sanitiseReviewsParams({ ratingFilter: [5, 0, 6, 2, 99] as never })).toEqual({
      ratingFilter: [5, 2],
    })
  })

  it('de-duplicates so a value is never sent twice', () => {
    expect(sanitiseReviewsParams({ ratingFilter: [4, 4, 4] })).toEqual({ ratingFilter: [4] })
  })

  /** Omitted rather than sent empty — an empty key would read as "match nothing". */
  it.each([
    ['an empty array', []],
    ['an array of only bad values', [0, 9]],
    ['a bare number', 5],
    ['null', null],
  ])('omits the key for %s', (_label, ratingFilter) => {
    expect(sanitiseReviewsParams({ ratingFilter } as never).ratingFilter).toBeUndefined()
  })
})

describe('buildReviewsQuery', () => {
  it('returns an empty string with no params', () => {
    expect(buildReviewsQuery({})).toBe('')
  })

  it('builds every param in a stable order', () => {
    expect(
      buildReviewsQuery({
        search: 'mezze',
        ratingFilter: [5],
        sortBy: 'date',
        sortOrder: 'desc',
        page: 1,
        pageSize: 10,
      }),
    ).toBe('?search=mezze&ratingFilter=5&sortBy=date&sortOrder=desc&page=1&pageSize=10')
  })

  /**
   * Repeated keys, not CSV. The backend accepts both, and repetition is what J3's
   * `buildUsersQueryString` established — it survives values containing a comma.
   */
  it('repeats the ratingFilter key rather than joining with commas', () => {
    const query = buildReviewsQuery({ ratingFilter: [5, 4, 3] })

    expect(query).toBe('?ratingFilter=5&ratingFilter=4&ratingFilter=3')
    expect(new URLSearchParams(query.slice(1)).getAll('ratingFilter')).toEqual(['5', '4', '3'])
    expect(query).not.toContain('5,4')
  })

  it('encodes a search term with spaces and punctuation', () => {
    const query = buildReviewsQuery({ search: 'mezze platter & branzino' })
    expect(new URLSearchParams(query.slice(1)).get('search')).toBe('mezze platter & branzino')
  })

  it('omits absent params entirely rather than sending them empty', () => {
    const query = buildReviewsQuery({ page: 3 })

    expect(query).toBe('?page=3')
    expect(query).not.toContain('search')
    expect(query).not.toContain('ratingFilter')
  })

  /** The service sanitises before building, so the pair must compose cleanly. */
  it('composes with the sanitiser', () => {
    const raw = { sortBy: 'nonsense', pageSize: 100, ratingFilter: [5, 7], page: 2 }
    expect(buildReviewsQuery(sanitiseReviewsParams(raw as never))).toBe('?ratingFilter=5&page=2')
  })
})

describe('ratingsFromFilter', () => {
  /** AntD reports `string[] | null`, with string members even for numeric filters. */
  it('reads the strings a filter control reports', () => {
    expect(ratingsFromFilter(['5', '3'])).toEqual([5, 3])
  })

  it('reads numbers too', () => {
    expect(ratingsFromFilter([2, 1])).toEqual([2, 1])
  })

  it.each([
    ['null — the cleared filter', null],
    ['undefined', undefined],
    ['an empty array', []],
    ['only unrecognised values', ['nine', '0']],
  ])('returns an empty array for %s', (_label, value) => {
    expect(ratingsFromFilter(value)).toEqual([])
  })

  /** Returns `[]` rather than undefined: the controller holds this as array state. */
  it('always returns an array, never undefined', () => {
    expect(Array.isArray(ratingsFromFilter(null))).toBe(true)
  })

  it('wraps a single non-array value', () => {
    expect(ratingsFromFilter('4')).toEqual([4])
  })

  it('feeds straight back into the sanitiser', () => {
    const params: ReviewsParams = { ratingFilter: ratingsFromFilter(['5', '2']) }
    expect(sanitiseReviewsParams(params)).toEqual({ ratingFilter: [5, 2] })
  })
})
