import { describe, expect, it } from 'vitest'
import { formatIban, isValidPkIban, normaliseIban } from '../iban'

describe('iban helpers', () => {
  it('normalises and groups', () => {
    expect(normaliseIban(' pk72 habb 0012 3456 7890 1234 ')).toBe('PK72HABB0012345678901234')
    expect(formatIban('pk72habb0012345678901234')).toBe('PK72 HABB 0012 3456 7890 1234')
  })

  it('accepts valid Pakistani IBANs and rejects bad checksums or shapes', () => {
    expect(isValidPkIban('PK72 HABB 0012 3456 7890 1234')).toBe(true)
    expect(isValidPkIban('PK40MEZN0000001123456702')).toBe(true)
    expect(isValidPkIban('PK00HABB0000000000000000')).toBe(false)
    expect(isValidPkIban('GB29NWBK60161331926819')).toBe(false)
    expect(isValidPkIban('')).toBe(false)
  })
})
