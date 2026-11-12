import type { ModuleKey } from '../../shared/services/permissions'
import { hasAccess, type Role } from '../../shared/services/permissions'

/**
 * Ordered list of top-level navigation destinations and the permission module
 * each one requires. Single source of truth shared by the Sidebar (to filter
 * items) and the landing redirect (to pick the first module a user can open).
 * Order matches the sidebar: MANAGE group first, then CONFIGURE.
 */
export interface NavAccessEntry {
  key: string
  path: string
  module: ModuleKey
}

export const NAV_ACCESS: readonly NavAccessEntry[] = [
  // MANAGE
  { key: 'restaurants', path: '/restaurants', module: 'MANAGE_RESTAURANTS' },
  { key: 'approval-queue', path: '/approval-queue', module: 'RESTAURANT_APPROVALS' },
  { key: 'interest-tables', path: '/interest-tables', module: 'MANAGE_RESTAURANTS' },
  { key: 'minglers', path: '/minglers', module: 'MANAGE_MINGLERS' },
  { key: 'finances', path: '/finances', module: 'FINANCES' },
  { key: 'change-log', path: '/change-log', module: 'CHANGE_LOG' },
  // CONFIGURE
  { key: 'amenities', path: '/amenities', module: 'AMENITIES' },
  { key: 'categories', path: '/categories', module: 'CATEGORIES' },
  { key: 'email-templates', path: '/email-templates', module: 'EMAIL_TEMPLATES' },
  { key: 'loyalty', path: '/loyalty', module: 'LOYALTY_CONFIGURATION' },
  { key: 'preference-questions', path: '/preference-questions', module: 'PREFERENCE_QUESTIONS' },
  { key: 'roles-access', path: '/roles-access', module: 'ROLES_AND_ACCESS' },
  { key: 'interests', path: '/interests', module: 'INTEREST_TOPICS' },
  { key: 'interest-topics', path: '/interest-topics', module: 'INTEREST_TOPICS' },
  { key: 'users', path: '/users', module: 'USERS' },
]

/** Map a sidebar item key to the permission module it requires. */
export function moduleForKey(key: string): ModuleKey | undefined {
  return NAV_ACCESS.find((e) => e.key === key)?.module
}

/**
 * First navigation path the given role can access, following NAV_ACCESS order.
 * Returns null when the role has access to no module at all.
 */
export function firstAccessiblePath(role: Role | null): string | null {
  const entry = NAV_ACCESS.find((e) => hasAccess(role, e.module))
  return entry ? entry.path : null
}
