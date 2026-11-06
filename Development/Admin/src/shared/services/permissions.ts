export type ModuleKey =
  | 'AUTHENTICATION'
  | 'ROLES_AND_ACCESS'
  | 'USERS'
  | 'CATEGORIES'
  | 'INTEREST_TOPICS'
  | 'LOYALTY_CONFIGURATION'
  | 'AMENITIES'
  | 'PREFERENCE_QUESTIONS'
  | 'TIMER_SETTINGS'
  | 'RESTAURANT_APPROVALS'
  | 'MANAGE_RESTAURANTS'
  | 'MANAGE_MINGLERS'
  | 'BOOKINGS'
  | 'REVIEWS'
  | 'FINANCES'
  | 'CHANGE_LOG'

export interface Role {
  id: string
  name: string
  fullAccess: boolean
  modules: ModuleKey[]
}

/** Minimal shape of the authenticated user needed to derive module access. */
export interface RoleSource {
  role: string
  permissions?: string[]
  fullAccess?: boolean
}

/**
 * Builds a Role from the authenticated user's permissions.
 * Permissions are resolved via GET /api/v1/auth/me → GET /api/v1/roles/{id}
 * (`permissions[]` + `fullAccess`) and persisted in the auth store, so this is
 * the single source of truth for RBAC.
 * Defaults guard against stale/partial persisted sessions that predate RBAC fields.
 */
export function getRoleFromUser(user: RoleSource | null | undefined): Role | null {
  if (!user) return null
  return {
    id: user.role,
    name: user.role,
    fullAccess: user.fullAccess ?? false,
    modules: (user.permissions ?? []) as ModuleKey[],
  }
}

export function hasAccess(role: Role | null, module: ModuleKey): boolean {
  if (!role) return false
  if (role.fullAccess) return true
  return role.modules?.includes(module) ?? false
}

export function hasCompositeAccess(role: Role | null, mod1: ModuleKey, mod2: ModuleKey): boolean {
  if (!role) return false
  if (role.fullAccess) return true
  return (role.modules?.includes(mod1) ?? false) && (role.modules?.includes(mod2) ?? false)
}

export function getAccessibleModules(role: Role | null): ModuleKey[] {
  if (!role) return []
  if (role.fullAccess) {
    return [
      'AUTHENTICATION',
      'ROLES_AND_ACCESS',
      'USERS',
      'CATEGORIES',
      'INTEREST_TOPICS',
      'LOYALTY_CONFIGURATION',
      'AMENITIES',
      'PREFERENCE_QUESTIONS',
      'TIMER_SETTINGS',
      'RESTAURANT_APPROVALS',
      'MANAGE_RESTAURANTS',
      'MANAGE_MINGLERS',
      'BOOKINGS',
      'REVIEWS',
      'FINANCES',
      'CHANGE_LOG',
    ]
  }
  return role.modules
}
