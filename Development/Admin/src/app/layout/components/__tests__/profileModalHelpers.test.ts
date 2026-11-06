import { describe, it, expect } from 'vitest'
import { getStrength } from '../profileModalHelpers'

describe('getStrength', () => {
  it('returns 0 for an empty password', () => {
    expect(getStrength('')).toBe(0)
  })

  it('returns 1 for a short password', () => {
    expect(getStrength('abc')).toBe(1)
  })

  it('returns 2 for a password with only length >= 6', () => {
    expect(getStrength('abcdef')).toBe(2)
  })

  it('returns 3 for a password with length >= 6 and a digit', () => {
    expect(getStrength('abcde1')).toBe(3)
  })

  it('returns 4 for a password with length >= 8, a digit, and a special character', () => {
    expect(getStrength('abcdef1!')).toBe(4)
  })
})
