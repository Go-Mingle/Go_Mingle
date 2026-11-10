import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  getInitials,
  formatDate,
  formatDateSafe,
  displayServerDate,
  DATE_FALLBACK,
} from '../shared/utils/formatting'

describe('formatCurrency', () => {
  it('formats with default PKR currency', () => {
    expect(formatCurrency(1000)).toBe('PKR 1,000')
  })

  it('formats zero amount', () => {
    expect(formatCurrency(0)).toBe('PKR 0')
  })

  it('formats with custom currency', () => {
    expect(formatCurrency(500, 'USD')).toBe('USD 500')
  })

  it('formats large numbers with locale separator', () => {
    expect(formatCurrency(1234567)).toBe('PKR 1,234,567')
  })
})

describe('getInitials', () => {
  it('returns two-letter initials for full name', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('returns single letter for single word name', () => {
    expect(getInitials('Alice')).toBe('A')
  })

  it('uses only first two words for long names', () => {
    expect(getInitials('John Michael Doe')).toBe('JM')
  })

  it('returns uppercase initials', () => {
    expect(getInitials('jane doe')).toBe('JD')
  })
})

describe('formatDate', () => {
  it('formats ISO date string to readable format', () => {
    const result = formatDate('2024-01-15')
    expect(result).toMatch(/Jan/)
    expect(result).toMatch(/15/)
    expect(result).toMatch(/2024/)
  })

  it('formats date with correct month abbreviation', () => {
    const result = formatDate('2024-06-01')
    expect(result).toMatch(/Jun/)
  })
})

describe('formatDateSafe (MET-1340)', () => {
  it('formats a valid ISO date with the default format', () => {
    expect(formatDateSafe('2024-01-10')).toBe('10 Jan 2024')
  })

  it('honours an explicit format', () => {
    expect(formatDateSafe('2024-01-10', 'YYYY-MM-DD')).toBe('2024-01-10')
  })

  it('round-trips an already-formatted date without mangling it', () => {
    expect(formatDateSafe('10 Jan 2024')).toBe('10 Jan 2024')
  })

  it('accepts an epoch-millisecond number', () => {
    expect(formatDateSafe(Date.UTC(2024, 0, 10), 'YYYY-MM-DD')).toBe('2024-01-10')
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty string', ''],
    ['a whitespace-only string', '   '],
    ['an unparseable string', 'not-a-real-date'],
    ['the literal Invalid Date', 'Invalid Date'],
    ['a non-string object', { when: '2024-01-10' }],
  ])('returns the fallback for %s', (_label, input) => {
    expect(formatDateSafe(input)).toBe(DATE_FALLBACK)
  })

  it('never returns the literal "Invalid Date"', () => {
    expect(formatDateSafe('garbage')).not.toBe('Invalid Date')
  })

  it('accepts a caller-supplied fallback', () => {
    expect(formatDateSafe(null, 'DD MMM YYYY', 'Unknown')).toBe('Unknown')
  })
})

describe('displayServerDate (MET-1340)', () => {
  it('passes a server-formatted date through untouched', () => {
    expect(displayServerDate('10 Jan 2024')).toBe('10 Jan 2024')
  })

  it('trims surrounding whitespace', () => {
    expect(displayServerDate('  10 Jan 2024  ')).toBe('10 Jan 2024')
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty string', ''],
    ['a whitespace-only string', '   '],
    ['the literal Invalid Date', 'Invalid Date'],
    ['a number', 1704844800000],
  ])('returns the fallback for %s', (_label, input) => {
    expect(displayServerDate(input)).toBe(DATE_FALLBACK)
  })

  it('accepts a caller-supplied fallback', () => {
    expect(displayServerDate('', 'Unknown')).toBe('Unknown')
  })
})
