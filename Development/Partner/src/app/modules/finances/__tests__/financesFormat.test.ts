import { describe, it, expect } from 'vitest'
import { formatPkr, formatLedgerDate, formatLoyaltyDeduction } from '../financesFormat'

describe('formatPkr', () => {
  /** BR-13's own examples: thousands separators, stored precision, no rounding. */
  it('adds the PKR prefix and thousands separators', () => {
    expect(formatPkr(2012)).toBe('PKR 2,012')
  })

  it('preserves a single decimal rather than padding to two', () => {
    expect(formatPkr(934.5)).toBe('PKR 934.5')
  })

  it('keeps two decimals when the value has them', () => {
    expect(formatPkr(1069.25)).toBe('PKR 1,069.25')
  })

  it('does not round away real precision', () => {
    expect(formatPkr(1620.4)).toBe('PKR 1,620.4')
  })

  it('handles zero', () => {
    expect(formatPkr(0)).toBe('PKR 0')
  })

  it('separates millions', () => {
    expect(formatPkr(1234567.89)).toBe('PKR 1,234,567.89')
  })

  it('falls back to an em dash for a non-finite value', () => {
    expect(formatPkr(Number.NaN)).toBe('—')
    expect(formatPkr(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('formatLoyaltyDeduction', () => {
  /** Positive and in the default colour — not the red negative the story described. */
  it('shows the amount and the points when something was redeemed', () => {
    expect(formatLoyaltyDeduction(8, 80)).toBe('PKR 8 (80 pts)')
  })

  it('separates large point totals', () => {
    expect(formatLoyaltyDeduction(120.5, 1205)).toBe('PKR 120.5 (1,205 pts)')
  })

  it('shows an em dash when nothing was redeemed (AC-03.4)', () => {
    expect(formatLoyaltyDeduction(0, 0)).toBe('—')
  })

  it('shows an em dash for a negative amount rather than a minus sign', () => {
    expect(formatLoyaltyDeduction(-5, 50)).toBe('—')
  })
})

describe('formatLedgerDate', () => {
  /**
   * Finances dates are YYYY-MM-DD in Asia/Karachi, unlike the rest of the portal's
   * DD-MM-YYYY. Reformatting risks a timezone shift moving a booking a day, so
   * the value is passed straight through.
   */
  it('renders the date exactly as received', () => {
    expect(formatLedgerDate('2026-05-04')).toBe('2026-05-04')
  })

  it('does not reformat into the portal-wide convention', () => {
    expect(formatLedgerDate('2026-05-04')).not.toBe('04-05-2026')
  })

  it('falls back to an em dash when absent', () => {
    expect(formatLedgerDate(null)).toBe('—')
    expect(formatLedgerDate(undefined)).toBe('—')
    expect(formatLedgerDate('  ')).toBe('—')
  })
})
