import { describe, it, expect } from 'vitest'
import { NAV_ACCESS, moduleForKey, firstAccessiblePath } from '../navAccess'
import { getRoleFromUser } from '../../../shared/services/permissions'

describe('navAccess.moduleForKey', () => {
  it('maps a sidebar key to its permission module', () => {
    expect(moduleForKey('finances')).toBe('FINANCES')
    expect(moduleForKey('roles-access')).toBe('ROLES_AND_ACCESS')
  })

  it('maps interests and interest-topics to INTEREST_TOPICS', () => {
    expect(moduleForKey('interests')).toBe('INTEREST_TOPICS')
    expect(moduleForKey('interest-topics')).toBe('INTEREST_TOPICS')
  })

  it('returns undefined for an unknown key', () => {
    expect(moduleForKey('does-not-exist')).toBeUndefined()
  })
})

describe('navAccess.firstAccessiblePath', () => {
  it('returns null for a role with no access', () => {
    const role = getRoleFromUser({ role: 'None', permissions: [], fullAccess: false })
    expect(firstAccessiblePath(role)).toBeNull()
  })

  it('returns null when role is null', () => {
    expect(firstAccessiblePath(null)).toBeNull()
  })

  it('returns the first NAV_ACCESS entry for a full-access role', () => {
    const role = getRoleFromUser({ role: 'Super Admin', permissions: [], fullAccess: true })
    expect(firstAccessiblePath(role)).toBe(NAV_ACCESS[0].path)
  })

  it('returns the first path the scoped role can access, in NAV_ACCESS order', () => {
    // Finance is later in the list than the manage modules; with only FINANCES
    // granted, it should be the first accessible path.
    const role = getRoleFromUser({ role: 'Finance', permissions: ['FINANCES'], fullAccess: false })
    expect(firstAccessiblePath(role)).toBe('/finances')
  })

  it('honors NAV_ACCESS ordering when multiple modules are granted', () => {
    const role = getRoleFromUser({
      role: 'Ops',
      permissions: ['AMENITIES', 'MANAGE_MINGLERS'],
      fullAccess: false,
    })
    // MANAGE_MINGLERS (manage group) comes before AMENITIES (configure group).
    expect(firstAccessiblePath(role)).toBe('/minglers')
  })
})
