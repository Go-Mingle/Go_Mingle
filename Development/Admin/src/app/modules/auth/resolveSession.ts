import { authService } from './services'
import type { MeResponse } from './services'

export interface ResolvedSession {
  me: MeResponse
  permissions: string[]
  fullAccess: boolean
}

/**
 * Resolves the current session's identity and RBAC from a single call:
 * GET /api/v1/auth/me now returns `role.permissions[]` and `role.fullAccess`
 * alongside identity, so no separate GET /api/v1/roles/{id} lookup is needed.
 *
 * The `me` call is intentionally left uncaught so callers keep their existing
 * 401 / ERR_ACCOUNT_SUSPENDED handling. Missing permissions degrade to "no
 * access" rather than dropping the session.
 */
export async function resolveMeWithPermissions(): Promise<ResolvedSession> {
  const me = await authService.getMe()
  return {
    me,
    permissions: me.role.permissions ?? [],
    fullAccess: me.role.fullAccess ?? false,
  }
}
