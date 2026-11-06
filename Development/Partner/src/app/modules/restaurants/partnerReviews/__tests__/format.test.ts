import { describe, it, expect } from 'vitest'
import {
  averageLabel,
  displayInterestTable,
  displayOrDash,
  distributionPercent,
  EM_DASH,
  minglerInitials,
  roundedStars,
} from '../format'

describe('displayOrDash', () => {
  it('returns the value when present', () => {
    expect(displayOrDash('Sana Khan')).toBe('Sana Khan')
  })

  it('trims surrounding whitespace', () => {
    expect(displayOrDash('  Wine & Dine  ')).toBe('Wine & Dine')
  })

  /** Four review fields are nullable; none may ever render as the string "null". */
  it.each([
    ['null — a deleted Mingler or retired topic', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['whitespace only', '   '],
  ])('returns a dash for %s', (_label, value) => {
    expect(displayOrDash(value)).toBe(EM_DASH)
    expect(displayOrDash(value)).not.toContain('null')
  })
})

describe('displayInterestTable', () => {
  /** BR-04 — the cell shows both, so they come back as a pair, not a joined string. */
  it('returns name and topic separately', () => {
    expect(displayInterestTable({ name: 'Friday Wine Evening', topic: 'Wine & Dine' })).toEqual({
      name: 'Friday Wine Evening',
      topic: 'Wine & Dine',
    })
  })

  /**
   * A null topic yields null rather than a dash: the cell drops to a single line
   * instead of showing a stray separator followed by nothing.
   */
  it('reports a missing topic as null so the second line can be omitted', () => {
    expect(displayInterestTable({ name: 'Friday Wine Evening', topic: null })).toEqual({
      name: 'Friday Wine Evening',
      topic: null,
    })
  })

  it('treats a blank topic as missing', () => {
    expect(displayInterestTable({ name: 'Tasting Night', topic: '  ' }).topic).toBeNull()
  })

  it('dashes a missing name while keeping the topic', () => {
    expect(displayInterestTable({ name: null, topic: 'Wine & Dine' })).toEqual({
      name: EM_DASH,
      topic: 'Wine & Dine',
    })
  })

  it('handles both being absent', () => {
    expect(displayInterestTable({ name: null, topic: null })).toEqual({
      name: EM_DASH,
      topic: null,
    })
  })
})

describe('minglerInitials', () => {
  it('takes the first and last word', () => {
    expect(minglerInitials('Sana Khan')).toBe('SK')
  })

  it('skips the middle of a three-part name', () => {
    expect(minglerInitials('Ayesha Noor Siddiqui')).toBe('AS')
  })

  it('doubles nothing for a single name', () => {
    expect(minglerInitials('Osama')).toBe('O')
  })

  it('upper-cases a lowercase name', () => {
    expect(minglerInitials('sana khan')).toBe('SK')
  })

  it('collapses irregular spacing', () => {
    expect(minglerInitials('  Sana   Khan  ')).toBe('SK')
  })

  /** A deleted Mingler leaves a null name; the avatar still needs a glyph. */
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['whitespace only', '   '],
  ])('falls back to a neutral glyph for %s', (_label, value) => {
    expect(minglerInitials(value)).toBe('?')
  })
})

describe('averageLabel', () => {
  /** The server sends `4` for a 4.0 average, which must not render beside "4.5" as "4". */
  it('pads a whole number to one decimal', () => {
    expect(averageLabel(4)).toBe('4.0')
  })

  it('keeps one decimal', () => {
    expect(averageLabel(4.5)).toBe('4.5')
  })

  it('rounds to one decimal', () => {
    expect(averageLabel(4.26)).toBe('4.3')
  })

  it('renders zero for a restaurant with no reviews', () => {
    expect(averageLabel(0)).toBe('0.0')
  })

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('falls back to 0.0 for %s', (_label, value) => {
    expect(averageLabel(value)).toBe('0.0')
  })
})

describe('roundedStars', () => {
  it.each([
    [4, 4],
    [4.4, 4],
    [4.5, 5],
    [0, 0],
    [5, 5],
  ])('lights %s stars for an average of %s', (average, expected) => {
    expect(roundedStars(average)).toBe(expected)
  })

  /** Clamped, so a malformed payload cannot light a sixth star. */
  it('never exceeds five', () => {
    expect(roundedStars(9)).toBe(5)
  })

  it('never goes below zero', () => {
    expect(roundedStars(-2)).toBe(0)
  })

  it('returns zero for NaN', () => {
    expect(roundedStars(Number.NaN)).toBe(0)
  })
})

describe('distributionPercent', () => {
  it('reports the share of the total', () => {
    expect(distributionPercent(3, 8)).toBe(38)
  })

  it('reports a full bar when every review shares a rating', () => {
    expect(distributionPercent(8, 8)).toBe(100)
  })

  it('reports an empty bar for a rating nobody gave', () => {
    expect(distributionPercent(0, 8)).toBe(0)
  })

  /** The empty state would otherwise divide by zero. */
  it.each([
    ['a zero total', 0, 0],
    ['a negative total', 3, -1],
  ])('returns 0 for %s', (_label, count, total) => {
    expect(distributionPercent(count, total)).toBe(0)
  })
})
