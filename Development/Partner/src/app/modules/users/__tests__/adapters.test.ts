import { describe, it, expect } from 'vitest'
import {
  buildUsersQueryString,
  hasNarrowingFilters,
  initialsOf,
  toApiStatus,
  toUserRow,
  toUserRows,
} from '../adapters'
import type { PartnerUserListItem } from '../types'

const base: PartnerUserListItem = {
  id: 'pu-2',
  fullName: 'Yasmeen Iqbal',
  designation: 'General Manager',
  lastActiveAt: '2026-05-04',
  status: 'ACTIVE',
  isPrimary: false,
  canSuspend: true,
  canDelete: true,
}

describe('hasNarrowingFilters (MET-1307)', () => {
  it('is false for an untouched grid', () => {
    expect(hasNarrowingFilters({})).toBe(false)
  })

  it('is false for paging alone', () => {
    expect(hasNarrowingFilters({ page: 3, pageSize: 50 })).toBe(false)
  })

  it('is false for sorting alone — a sort reorders, it never removes', () => {
    expect(hasNarrowingFilters({ sortBy: 'name', sortOrder: 'asc' })).toBe(false)
  })

  it('is false for a whitespace-only search, which is never sent', () => {
    expect(hasNarrowingFilters({ search: '   ' })).toBe(false)
  })

  it('is false for an empty status selection', () => {
    expect(hasNarrowingFilters({ status: [] })).toBe(false)
  })

  it.each([
    ['search', { search: 'yas' }],
    ['status', { status: ['ACTIVE' as const] }],
    ['lastActiveFrom', { lastActiveFrom: '2026-01-01' }],
    ['lastActiveTo', { lastActiveTo: '2026-02-01' }],
  ])('is true for %s', (_label, params) => {
    expect(hasNarrowingFilters(params)).toBe(true)
  })
})

describe('initialsOf', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsOf('Yasmeen Iqbal')).toBe('YI')
  })

  it('caps at two letters for longer names', () => {
    expect(initialsOf('Maria de los Angeles Cruz')).toBe('MD')
  })

  it('handles a single word', () => {
    expect(initialsOf('Osama')).toBe('O')
  })

  it('ignores repeated spaces rather than emitting undefined', () => {
    expect(initialsOf('Hira   Mansoor')).toBe('HM')
  })

  it('returns an empty string for an empty name', () => {
    expect(initialsOf('')).toBe('')
  })
})

describe('toUserRow', () => {
  it('maps the API vocabulary onto the shape the UI reads', () => {
    expect(toUserRow(base)).toEqual({
      id: 'pu-2',
      name: 'Yasmeen Iqbal',
      designation: 'General Manager',
      status: 'active',
      lastActive: '2026-05-04',
      initials: 'YI',
      isPrimary: false,
      canSuspend: true,
      canDelete: true,
      email: undefined,
    })
  })

  it('lowercases SUSPENDED so the existing status comparisons keep working', () => {
    expect(toUserRow({ ...base, status: 'SUSPENDED' }).status).toBe('suspended')
  })

  it('turns a null designation into undefined so the UI renders its em dash', () => {
    expect(toUserRow({ ...base, designation: null }).designation).toBeUndefined()
  })

  it('turns a null lastActiveAt into undefined — never logged in (BR-13)', () => {
    expect(toUserRow({ ...base, lastActiveAt: null }).lastActive).toBeUndefined()
  })

  it('carries an email through when the response includes one', () => {
    expect(toUserRow({ ...base, email: 'yasmeen@aurelia.pk' }).email).toBe('yasmeen@aurelia.pk')
  })

  it('maps a whole page', () => {
    expect(toUserRows([base, { ...base, id: 'pu-3', fullName: 'Osama Hashmi' }])).toHaveLength(2)
  })
})

describe('toApiStatus', () => {
  it.each([
    ['active', 'ACTIVE'],
    ['suspended', 'SUSPENDED'],
    ['ACTIVE', 'ACTIVE'],
    ['SUSPENDED', 'SUSPENDED'],
  ])('maps %s to %s', (input, expected) => {
    expect(toApiStatus(input)).toBe(expected)
  })

  it('defaults anything unrecognised to ACTIVE', () => {
    expect(toApiStatus('whatever')).toBe('ACTIVE')
  })
})

describe('buildUsersQueryString', () => {
  it('returns an empty string when nothing is set, so the backend applies its defaults', () => {
    expect(buildUsersQueryString({})).toBe('')
  })

  it('serialises paging and sorting', () => {
    expect(buildUsersQueryString({ page: 2, pageSize: 25, sortBy: 'name', sortOrder: 'asc' })).toBe(
      '?page=2&pageSize=25&sortBy=name&sortOrder=asc',
    )
  })

  it('repeats the status key rather than sending CSV', () => {
    expect(buildUsersQueryString({ status: ['ACTIVE', 'SUSPENDED'] })).toBe(
      '?status=ACTIVE&status=SUSPENDED',
    )
  })

  it('trims the search term and omits it when blank', () => {
    expect(buildUsersQueryString({ search: '  yasmeen  ' })).toBe('?search=yasmeen')
    expect(buildUsersQueryString({ search: '   ' })).toBe('')
  })

  it('includes searchField only when given', () => {
    expect(buildUsersQueryString({ search: 'gm', searchField: 'designation' })).toBe(
      '?search=gm&searchField=designation',
    )
  })

  it('serialises the date bounds', () => {
    expect(
      buildUsersQueryString({ lastActiveFrom: '2026-01-01', lastActiveTo: '2026-02-01' }),
    ).toBe('?lastActiveFrom=2026-01-01&lastActiveTo=2026-02-01')
  })

  it('sends page 1 rather than dropping it', () => {
    expect(buildUsersQueryString({ page: 1 })).toBe('?page=1')
  })
})
