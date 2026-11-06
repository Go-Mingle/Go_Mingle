import { describe, it, expect } from 'vitest'
import {
  displayOr,
  displayProfileDate,
  formatCommission,
  formatPhoneForDisplay,
  hasProfileValue,
  omitEmpty,
  toE164,
} from '../format'

/**
 * The API requires compact E.164 (`+923001234567`), while the spec's examples and
 * the design show `+92 300 123 4567`. Those spaces are display only and are
 * rejected on the wire, so this pair is what keeps the two apart.
 */
describe('toE164', () => {
  it('strips the display spacing the design shows', () => {
    expect(toE164('+92 300 123 4567')).toBe('+923001234567')
  })

  it('strips dashes and brackets too', () => {
    expect(toE164('+92 (300) 123-4567')).toBe('+923001234567')
  })

  it('leaves an already-compact number alone', () => {
    expect(toE164('+923001234567')).toBe('+923001234567')
  })

  it('keeps only a leading plus, dropping stray ones', () => {
    expect(toE164('+92+300+1234567')).toBe('+923001234567')
  })

  it('preserves a number with no country prefix rather than inventing one', () => {
    expect(toE164('0501234567')).toBe('0501234567')
  })

  it('returns an empty string for blank input, so the caller can omit the field', () => {
    expect(toE164('')).toBe('')
    expect(toE164('   ')).toBe('')
    expect(toE164(null)).toBe('')
    expect(toE164(undefined)).toBe('')
  })
})

describe('formatPhoneForDisplay', () => {
  it('groups a Pakistan number the way the design shows it', () => {
    expect(formatPhoneForDisplay('+923001234567')).toBe('+92 300 123 4567')
  })

  it('is stable when given an already-spaced value', () => {
    expect(formatPhoneForDisplay('+92 300 123 4567')).toBe('+92 300 123 4567')
  })

  it('groups a Karachi landline as +92 21 XXXX XXXX', () => {
    expect(formatPhoneForDisplay('+922135250000')).toBe('+92 21 3525 0000')
  })

  it('groups other 12-digit international numbers by their own pattern', () => {
    expect(formatPhoneForDisplay('+971501234567')).toBe('+971 50 123 4567')
  })

  it('groups a non-Pakistan international number without mangling it', () => {
    expect(formatPhoneForDisplay('+4471234567890')).toBe('+447 1234567890')
  })

  it('shows a local number as-is rather than hiding it', () => {
    expect(formatPhoneForDisplay('0501234567')).toBe('0501234567')
  })

  it('returns empty for nothing', () => {
    expect(formatPhoneForDisplay(null)).toBe('')
  })

  /** Round-tripping must not corrupt the wire value. */
  it('survives a display → wire round trip', () => {
    expect(toE164(formatPhoneForDisplay('+923001234567'))).toBe('+923001234567')
  })
})

/**
 * A fresh Draft returns null for most fields — including the name — so
 * placeholders are driven off null, not off empty string.
 */
describe('hasProfileValue', () => {
  it.each([null, undefined, '', '   '])('treats %p as absent', (value) => {
    expect(hasProfileValue(value)).toBe(false)
  })

  it.each(['Aurelia', 0, false, 25.08])('treats %p as present', (value) => {
    expect(hasProfileValue(value)).toBe(true)
  })
})

describe('displayOr', () => {
  it('shows the value when present', () => {
    expect(displayOr(' Aurelia ', 'Not provided')).toBe('Aurelia')
  })

  it('falls back for a null Draft field', () => {
    expect(displayOr(null, 'Add your restaurant name')).toBe('Add your restaurant name')
  })

  it('falls back for whitespace', () => {
    expect(displayOr('  ', 'Not provided')).toBe('Not provided')
  })
})

describe('displayProfileDate', () => {
  /**
   * MET-1250 — J6A sends `DD-MM-YYYY HH:MM`, the convention is `YYYY-MM-DD`, and
   * BR-13 asks for a date. Both divergences are corrected here.
   */
  it('reorders the day-first timestamp and drops the time', () => {
    expect(displayProfileDate('02-08-2026 14:20')).toBe('2026-08-02')
    expect(displayProfileDate('19-08-2026 18:56')).toBe('2026-08-19')
  })

  it('reorders a day-first date that carries no time', () => {
    expect(displayProfileDate('21-07-2026')).toBe('2026-07-21')
  })

  it('keeps seconds out of the result', () => {
    expect(displayProfileDate('02-08-2026 14:20:59')).toBe('2026-08-02')
  })

  /**
   * The reorder is string work, not a dayjs reparse: `dayjs('19-08-2026')` reads
   * the leading `19` as a month and yields `Invalid Date`.
   */
  it('never renders an invalid date', () => {
    expect(displayProfileDate('19-08-2026 18:56')).not.toMatch(/invalid/i)
  })

  it('leaves an already-correct date untouched', () => {
    expect(displayProfileDate('2026-08-19')).toBe('2026-08-19')
  })

  /** No offset means the contract's "already Asia/Karachi", so no conversion. */
  it('takes the date part of an offset-less ISO timestamp as-is', () => {
    expect(displayProfileDate('2026-08-19T18:56')).toBe('2026-08-19')
    expect(displayProfileDate('2026-08-19T18:56:00.500')).toBe('2026-08-19')
    expect(displayProfileDate('2026-08-19 18:56')).toBe('2026-08-19')
  })

  /**
   * A `Z`/`±HH:MM` instant is the one case where slicing would be wrong — 21:00
   * UTC is already the next day in Karachi (UTC+5), so it is converted properly.
   */
  it('converts a UTC instant to the Asia/Karachi calendar day', () => {
    expect(displayProfileDate('2026-08-19T14:20:00Z')).toBe('2026-08-19')
    expect(displayProfileDate('2026-08-19T21:00:00Z')).toBe('2026-08-20')
    expect(displayProfileDate('2026-08-19T22:30:00+00:00')).toBe('2026-08-20')
  })

  /** An unanticipated shape is information, not noise — it is not hidden. */
  it('renders an unrecognised value verbatim', () => {
    expect(displayProfileDate('19 Aug 2026')).toBe('19 Aug 2026')
    expect(displayProfileDate('  2 August 2026  ')).toBe('2 August 2026')
  })

  it('renders an offset-shaped but unparseable value verbatim', () => {
    expect(displayProfileDate('not-a-date+05:00')).toBe('not-a-date+05:00')
  })

  it('falls back to an em dash', () => {
    expect(displayProfileDate(null)).toBe('—')
    expect(displayProfileDate(undefined)).toBe('—')
    expect(displayProfileDate('  ')).toBe('—')
  })
})

describe('formatCommission', () => {
  it('renders a percentage', () => {
    expect(formatCommission(12, '—')).toBe('12%')
  })

  it('keeps a fractional rate', () => {
    expect(formatCommission(12.5, '—')).toBe('12.5%')
  })

  it('falls back when the category is unassigned', () => {
    expect(formatCommission(null, 'Not assigned')).toBe('Not assigned')
    expect(formatCommission(undefined, 'Not assigned')).toBe('Not assigned')
  })
})

/**
 * The API treats an absent key as "leave untouched" and does not accept null as
 * a way to clear a field, so a blank input must be omitted rather than sent.
 */
describe('omitEmpty', () => {
  it('drops undefined, null and blank strings', () => {
    expect(omitEmpty({ a: 'keep', b: undefined, c: null, d: '', e: '   ' })).toEqual({ a: 'keep' })
  })

  it('keeps false and zero, which are real values', () => {
    expect(omitEmpty({ servesAlcohol: false, latitude: 0 })).toEqual({
      servesAlcohol: false,
      latitude: 0,
    })
  })

  it('returns an empty object when nothing survives', () => {
    expect(omitEmpty({ a: '', b: undefined })).toEqual({})
  })
})
