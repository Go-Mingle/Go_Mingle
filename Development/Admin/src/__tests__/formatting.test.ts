import { describe, it, expect } from 'vitest'
import { formatCurrency, getInitials, formatDate } from '../shared/utils/formatting'

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
