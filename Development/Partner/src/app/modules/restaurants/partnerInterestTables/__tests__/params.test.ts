import { describe, it, expect } from 'vitest'
import { buildInterestTablesQuery, sanitiseInterestTablesParams, statusFromFilter } from '../params'

describe('sanitiseInterestTablesParams', () => {
  it('keeps a valid full set', () => {
    expect(
      sanitiseInterestTablesParams({
        page: 2,
        pageSize: 25,
        status: 'CONFIRMED',
        sortBy: 'date',
        sortOrder: 'desc',
      }),
    ).toEqual({ page: 2, pageSize: 25, status: 'CONFIRMED', sortBy: 'date', sortOrder: 'desc' })
  })

  it('returns nothing for no input, letting the server default', () => {
    expect(sanitiseInterestTablesParams()).toEqual({})
    expect(sanitiseInterestTablesParams({})).toEqual({})
  })

  it.each([['PENDING'], ['COMING_SOON'], ['CONFIRMED'], ['COMPLETED'], ['CANCELLED']])(
    'accepts the visible status %s',
    (status) => {
      expect(sanitiseInterestTablesParams({ status }).status).toBe(status)
    },
  )

  it('drops DRAFT rather than forwarding it', () => {
    // Draft is not a partner-visible status (BR-03). A hand-edited URL asking for it
    // must degrade to "all" — never error, and never leak Draft rows.
    expect(sanitiseInterestTablesParams({ status: 'DRAFT' }).status).toBeUndefined()
  })

  it.each([['draft'], ['confirmed'], ['NOPE'], [''], [42], [null], [['CONFIRMED']]])(
    'drops the unusable status %s',
    (status) => {
      expect(sanitiseInterestTablesParams({ status }).status).toBeUndefined()
    },
  )

  it.each([
    [1, 1],
    [7, 7],
  ])('accepts page %i', (page, expected) => {
    expect(sanitiseInterestTablesParams({ page }).page).toBe(expected)
  })

  it('accepts a numeric string page, as a URL would supply it', () => {
    expect(sanitiseInterestTablesParams({ page: '3' }).page).toBe(3)
  })

  it.each([[0], [-1], [1.5], ['abc'], [null], [undefined]])('drops page %s', (page) => {
    expect(sanitiseInterestTablesParams({ page }).page).toBeUndefined()
  })

  // The set matches the shared pagination control's dropdown, so every size a
  // partner can pick is one the params layer forwards.
  it.each([[10], [25], [50], [100], ['25']])('accepts the offered page size %s', (pageSize) => {
    expect(sanitiseInterestTablesParams({ pageSize }).pageSize).toBe(Number(pageSize))
  })

  it.each([[15], [200], [0], ['abc']])('drops the unoffered page size %s', (pageSize) => {
    expect(sanitiseInterestTablesParams({ pageSize }).pageSize).toBeUndefined()
  })

  it('trims a sort field', () => {
    expect(sanitiseInterestTablesParams({ sortBy: '  date  ' }).sortBy).toBe('date')
  })

  it.each([[''], ['   '], [42], [null]])('drops the unusable sort field %s', (sortBy) => {
    expect(sanitiseInterestTablesParams({ sortBy }).sortBy).toBeUndefined()
  })

  it('never sends an order without a field', () => {
    // Ordering with nothing to order by is meaningless and risks a 422.
    expect(sanitiseInterestTablesParams({ sortOrder: 'asc' })).toEqual({})
  })

  it('drops an unrecognised order but keeps the field', () => {
    expect(sanitiseInterestTablesParams({ sortBy: 'date', sortOrder: 'sideways' })).toEqual({
      sortBy: 'date',
    })
  })
})

describe('buildInterestTablesQuery', () => {
  it('returns an empty string for no params, so the URL stays clean', () => {
    expect(buildInterestTablesQuery({})).toBe('')
  })

  it('builds paging', () => {
    expect(buildInterestTablesQuery({ page: 2, pageSize: 25 })).toBe('?page=2&pageSize=25')
  })

  it('builds the status filter', () => {
    expect(buildInterestTablesQuery({ status: 'CONFIRMED' })).toBe('?status=CONFIRMED')
  })

  it('builds every param in a stable order', () => {
    expect(
      buildInterestTablesQuery({
        page: 1,
        pageSize: 10,
        status: 'PENDING',
        sortBy: 'date',
        sortOrder: 'asc',
      }),
    ).toBe('?page=1&pageSize=10&status=PENDING&sortBy=date&sortOrder=asc')
  })

  it('omits absent params rather than sending empty values', () => {
    expect(buildInterestTablesQuery({ page: 3 })).toBe('?page=3')
  })
})

describe('statusFromFilter', () => {
  it("reads AntD's array payload", () => {
    expect(statusFromFilter(['CONFIRMED'])).toBe('CONFIRMED')
  })

  it('takes the first value when the control offers several', () => {
    // The endpoint takes one status, so a multi-select payload is narrowed.
    expect(statusFromFilter(['COMPLETED', 'CANCELLED'])).toBe('COMPLETED')
  })

  it('reads a bare value', () => {
    expect(statusFromFilter('PENDING')).toBe('PENDING')
  })

  it.each([[null], [undefined], [[]], [['DRAFT']], [['nope']], [42]])(
    'clears the filter for %s',
    (value) => {
      expect(statusFromFilter(value)).toBeUndefined()
    },
  )
})
