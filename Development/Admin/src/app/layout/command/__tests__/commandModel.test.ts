import { afterEach, describe, expect, it } from 'vitest'
import {
  PAGE_COMMANDS,
  bookingRefFrom,
  matchScore,
  pagesFor,
  pushRecent,
  rankPages,
  readRecent,
} from '../commandModel'

const role = (modules: string[], fullAccess = false) =>
  ({ id: 'r', name: 'R', fullAccess, modules }) as never

describe('matchScore', () => {
  it('ranks a prefix over a word start over a substring', () => {
    expect(matchScore('Restaurants', 'rest')).toBe(3)
    expect(matchScore('Approval Queue', 'que')).toBe(2)
    expect(matchScore('Restaurants', 'aura')).toBe(1)
    expect(matchScore('Restaurants', 'zz')).toBe(0)
  })

  it('ignores case and accents', () => {
    expect(matchScore('Café Aylanto', 'cafe')).toBe(3)
  })
})

describe('rankPages', () => {
  const label = (p: (typeof PAGE_COMMANDS)[number]) => p.key
  it('finds a page by one of its keywords', () => {
    expect(rankPages(PAGE_COMMANDS, 'payouts', label).map((p) => p.key)).toContain('finances')
  })
  it('puts label matches first', () => {
    expect(rankPages(PAGE_COMMANDS, 'interest', label)[0].key).toMatch(/^interest/)
  })
})

describe('pagesFor', () => {
  it('only lists pages the role can open, plus the open ones', () => {
    const keys = pagesFor(role(['AMENITIES'])).map((p) => p.key)
    expect(keys).toEqual(['notifications', 'amenities'])
  })
  it('lists every page for full access', () => {
    expect(pagesFor(role([], true))).toHaveLength(PAGE_COMMANDS.length)
  })
  it('lists only open pages when signed out', () => {
    expect(pagesFor(null).map((p) => p.key)).toEqual(['notifications'])
  })
})

describe('bookingRefFrom', () => {
  it('accepts the common ways of typing a reference', () => {
    expect(bookingRefFrom('GM-123456')).toBe('GM-123456')
    expect(bookingRefFrom('gm123456')).toBe('GM-123456')
    expect(bookingRefFrom(' gm 123456 ')).toBe('GM-123456')
  })
  it('rejects anything else', () => {
    expect(bookingRefFrom('GM-12')).toBeNull()
    expect(bookingRefFrom('gomingle')).toBeNull()
  })
})

describe('recent items', () => {
  afterEach(() => window.localStorage.clear())

  it('keeps the newest five, without duplicates', () => {
    for (let i = 0; i < 7; i++) pushRecent({ kind: 'page', title: `P${i}`, path: `/p${i}` })
    pushRecent({ kind: 'page', title: 'P3', path: '/p3' })
    expect(readRecent().map((r) => r.path)).toEqual(['/p3', '/p6', '/p5', '/p4', '/p2'])
  })

  it('survives broken storage', () => {
    window.localStorage.setItem('gm-admin-command-recent', '{not json')
    expect(readRecent()).toEqual([])
  })
})
