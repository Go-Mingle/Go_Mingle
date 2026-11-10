import { describe, it, expect } from 'vitest'
import { getStrength, meetsPasswordPolicy, STRENGTH_COLORS } from '../passwordStrength'

describe('getStrength', () => {
  it('scores one point per satisfied class', () => {
    expect(getStrength('')).toBe(0)
    expect(getStrength('short')).toBe(0)
    expect(getStrength('aureliaa')).toBe(1)
    expect(getStrength('aurelia1')).toBe(2)
    expect(getStrength('Aurelia1')).toBe(3)
    expect(getStrength('Aurelia1!')).toBe(4)
  })

  it('exposes a colour per score band', () => {
    expect(STRENGTH_COLORS).toHaveLength(4)
  })
})

describe('meetsPasswordPolicy', () => {
  it('accepts eight characters plus a number', () => {
    expect(meetsPasswordPolicy('aurelia1')).toBe(true)
  })

  it('accepts eight characters plus a symbol', () => {
    expect(meetsPasswordPolicy('aurelia!')).toBe(true)
  })

  it('accepts eight characters plus an uppercase letter', () => {
    expect(meetsPasswordPolicy('aureliaA')).toBe(true)
  })

  it('does not require all three classes at once', () => {
    // The rule is an OR. Demanding all three would reject passwords the
    // backend accepts.
    expect(meetsPasswordPolicy('aurelia1')).toBe(true)
    expect(getStrength('aurelia1')).toBeLessThan(4)
  })

  it('rejects eight or more lowercase-only characters', () => {
    expect(meetsPasswordPolicy('aureliaa')).toBe(false)
  })

  it('rejects anything shorter than eight characters, however complex', () => {
    // This is the case a strength score gets wrong: three classes satisfied
    // scores 3, but the backend rejects it with 422.
    expect(getStrength('Ab1!')).toBe(3)
    expect(meetsPasswordPolicy('Ab1!')).toBe(false)
  })

  it('rejects an empty password', () => {
    expect(meetsPasswordPolicy('')).toBe(false)
  })

  it('accepts exactly eight characters at the boundary', () => {
    expect(meetsPasswordPolicy('Aurelia1')).toBe(true)
    expect(meetsPasswordPolicy('Aurelia')).toBe(false)
  })
})
