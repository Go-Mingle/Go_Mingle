import { describe, it, expect } from 'vitest'
import {
  getRoleFromUser,
  hasAccess,
  hasCompositeAccess,
  getAccessibleModules,
} from '../permissions'

const fullAccessUser = {
  role: 'Super Admin',
  permissions: [],
  fullAccess: true,
}

const scopedUser = {
  role: 'Finance Manager',
  permissions: ['FINANCES', 'CHANGE_LOG'],
  fullAccess: false,
}

describe('getRoleFromUser', () => {
  it('returns null when the user is null or undefined', () => {
    expect(getRoleFromUser(null)).toBeNull()
    expect(getRoleFromUser(undefined)).toBeNull()
  })

  it('builds a full-access role from the user', () => {
    expect(getRoleFromUser(fullAccessUser)).toEqual({
      id: 'Super Admin',
      name: 'Super Admin',
      fullAccess: true,
      modules: [],
    })
  })

  it('builds a scoped role from the user permissions', () => {
    expect(getRoleFromUser(scopedUser)).toEqual({
      id: 'Finance Manager',
      name: 'Finance Manager',
      fullAccess: false,
      modules: ['FINANCES', 'CHANGE_LOG'],
    })
  })

  it('defaults to an empty, non-full-access role for a stale/partial persisted user', () => {
    // Sessions persisted before RBAC fields existed lack permissions/fullAccess.
    const role = getRoleFromUser({ role: 'Legacy' } as { role: string })
    expect(role).toEqual({ id: 'Legacy', name: 'Legacy', fullAccess: false, modules: [] })
    // Must not throw when checked (regression: undefined.includes crash).
    expect(hasAccess(role, 'FINANCES')).toBe(false)
  })
})

describe('hasAccess', () => {
  it('returns false when role is null', () => {
    expect(hasAccess(null, 'FINANCES')).toBe(false)
  })

  it('returns true for any module when role has fullAccess', () => {
    const role = getRoleFromUser(fullAccessUser)
    expect(hasAccess(role, 'AUTHENTICATION')).toBe(true)
    expect(hasAccess(role, 'CHANGE_LOG')).toBe(true)
  })

  it('returns true when the scoped role includes the module', () => {
    const role = getRoleFromUser(scopedUser)
    expect(hasAccess(role, 'FINANCES')).toBe(true)
  })

  it('returns false when the scoped role does not include the module', () => {
    const role = getRoleFromUser(scopedUser)
    expect(hasAccess(role, 'BOOKINGS')).toBe(false)
  })

  it('gates INTEREST_TOPICS independently of CATEGORIES for a scoped role', () => {
    // A role with only CATEGORIES must NOT gain INTEREST_TOPICS access, and
    // vice-versa — the two modules are now decoupled.
    const categoriesOnly = getRoleFromUser({
      role: 'Content',
      permissions: ['CATEGORIES'],
      fullAccess: false,
    })
    expect(hasAccess(categoriesOnly, 'CATEGORIES')).toBe(true)
    expect(hasAccess(categoriesOnly, 'INTEREST_TOPICS')).toBe(false)

    const topicsOnly = getRoleFromUser({
      role: 'Topics',
      permissions: ['INTEREST_TOPICS'],
      fullAccess: false,
    })
    expect(hasAccess(topicsOnly, 'INTEREST_TOPICS')).toBe(true)
    expect(hasAccess(topicsOnly, 'CATEGORIES')).toBe(false)
  })

  it('grants INTEREST_TOPICS to a full-access role', () => {
    const role = getRoleFromUser(fullAccessUser)
    expect(hasAccess(role, 'INTEREST_TOPICS')).toBe(true)
  })
})

describe('hasCompositeAccess', () => {
  it('returns false when role is null', () => {
    expect(hasCompositeAccess(null, 'FINANCES', 'CHANGE_LOG')).toBe(false)
  })

  it('returns true for any module pair when role has fullAccess', () => {
    const role = getRoleFromUser(fullAccessUser)
    expect(hasCompositeAccess(role, 'AUTHENTICATION', 'ROLES_AND_ACCESS')).toBe(true)
  })

  it('returns true when the scoped role includes both modules', () => {
    const role = getRoleFromUser(scopedUser)
    expect(hasCompositeAccess(role, 'FINANCES', 'CHANGE_LOG')).toBe(true)
  })

  it('returns false when the scoped role is missing one of the two modules', () => {
    const role = getRoleFromUser(scopedUser)
    expect(hasCompositeAccess(role, 'FINANCES', 'BOOKINGS')).toBe(false)
  })
})

describe('getAccessibleModules', () => {
  it('returns an empty array when role is null', () => {
    expect(getAccessibleModules(null)).toEqual([])
  })

  it('returns every module when role has fullAccess', () => {
    const role = getRoleFromUser(fullAccessUser)
    expect(getAccessibleModules(role)).toEqual([
      'AUTHENTICATION',
      'ROLES_AND_ACCESS',
      'USERS',
      'CATEGORIES',
      'INTEREST_TOPICS',
      'LOYALTY_CONFIGURATION',
      'AMENITIES',
      'PREFERENCE_QUESTIONS',
      'TIMER_SETTINGS',
      'EMAIL_TEMPLATES',
      'RESTAURANT_APPROVALS',
      'MANAGE_RESTAURANTS',
      'MANAGE_MINGLERS',
      'BOOKINGS',
      'REVIEWS',
      'FINANCES',
      'CHANGE_LOG',
    ])
  })

  it('returns only the scoped role modules when fullAccess is false', () => {
    const role = getRoleFromUser(scopedUser)
    expect(getAccessibleModules(role)).toEqual(['FINANCES', 'CHANGE_LOG'])
  })
})
