import { describe, it, expect } from 'vitest'
import { getAvatarColor, getInitials, AVATAR_PALETTE } from '../components/utils'

describe('getAvatarColor', () => {
  it('returns deterministic color', () => {
    expect(getAvatarColor('Alice')).toEqual(getAvatarColor('Alice'))
  })

  it('returns a palette entry', () => {
    const c = getAvatarColor('A')
    expect(AVATAR_PALETTE).toContainEqual(c)
  })
})

describe('getInitials', () => {
  it('returns the first letter of the first two words uppercased', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })
})
