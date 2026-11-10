import { describe, it, expect } from 'vitest'
import { getInitials, getAvatarColor } from '../components/approvalQueueCardUtils'

describe('getInitials', () => {
  it('returns "??" when the name has no letters', () => {
    expect(getInitials('   ')).toBe('??')
  })

  it('returns the first two letters uppercased for a single word', () => {
    expect(getInitials('restaurant')).toBe('RE')
  })

  it('returns the first letter of the first two words uppercased', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })
})

describe('getAvatarColor', () => {
  it('returns a deterministic color from the palette', () => {
    expect(getAvatarColor('Alice')).toEqual(getAvatarColor('Alice'))
  })
})
