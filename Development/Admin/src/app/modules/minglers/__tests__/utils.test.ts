import { describe, it, expect } from 'vitest'
import {
  getAvatarBg,
  getInitials,
  HERO_STATUS_CONFIG,
  BOOKING_STATUS_COLORS,
  BOOKING_STATUS_LABELS,
  AVATAR_PALETTE,
} from '../components/utils'

describe('minglers/utils', () => {
  it('getAvatarBg returns palette entry', () => {
    expect(AVATAR_PALETTE).toContain(getAvatarBg('Alice'))
  })

  it('getInitials handles empty/single/multi', () => {
    expect(getInitials('')).toBe('??')
    expect(getInitials('A')).toBe('A')
    expect(getInitials('Single')).toBe('SI')
    expect(getInitials('Two Words')).toBe('TW')
    expect(getInitials('A B C')).toBe('AC')
  })

  it('exports config objects', () => {
    expect(HERO_STATUS_CONFIG.ACTIVE.label).toBeTruthy()
    expect(BOOKING_STATUS_COLORS.completed).toBeTruthy()
    expect(BOOKING_STATUS_LABELS.completed).toBeTruthy()
  })
})
