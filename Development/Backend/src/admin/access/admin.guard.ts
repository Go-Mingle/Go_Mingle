import { CanActivate, createParamDecorator, ExecutionContext, Injectable } from '@nestjs/common'
import type { Request } from 'express'
import { apiError } from '../../common/errors'
import { ADMIN_AUDIENCE, bearer, TokensService } from '../../auth/tokens.service'
import { AdminAccountsService, type AdminSession } from './admin-accounts.service'
import { AdminSecurityService } from './admin-security.service'

export type AdminRequest = Request & { admin?: AdminSession; adminSessionId?: string | null }

/**
 * Admin Panel routes: a valid admin access token for an ACTIVE account.
 * 401 ERR_TOKEN_EXPIRED / ERR_TOKEN_INVALID, 403 ERR_ACCOUNT_SUSPENDED.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly tokens: TokensService,
    private readonly accounts: AdminAccountsService,
    private readonly security: AdminSecurityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>()
    req.admin = await resolveAdmin(req, this.tokens, this.accounts, this.security)
    await requireTwoStepIfAsked(req.admin, this.security)
    return true
  }
}

/**
 * The signed-in admin for a request; throws the portal's auth errors. A token
 * whose sign-in session was signed out (Security page) stops working at once.
 */
export async function resolveAdmin(
  req: Request,
  tokens: TokensService,
  accounts: AdminAccountsService,
  security?: AdminSecurityService,
): Promise<AdminSession> {
  const { claims, error } = tokens.verify(bearer(req), ADMIN_AUDIENCE)
  if (!claims) throw apiError(401, error ?? 'ERR_TOKEN_INVALID', 'Authentication required')
  const user = await accounts.byId(claims.sub)
  if (!user) throw apiError(401, 'ERR_TOKEN_INVALID', 'Unknown user')
  if (user.status !== 'ACTIVE') throw apiError(403, 'ERR_ACCOUNT_SUSPENDED', 'Account suspended')
  if (claims.sid && security && !(await security.touch(claims.sid, user.id))) {
    throw apiError(401, 'ERR_SESSION_REVOKED', 'This sign-in was signed out')
  }
  ;(req as AdminRequest).adminSessionId = claims.sid ?? null
  return user
}

/**
 * When a super admin requires two-step sign-in, an admin who hasn't set it up
 * can only reach the sign-in and Security endpoints until they do.
 */
export async function requireTwoStepIfAsked(user: AdminSession, security: AdminSecurityService) {
  if (security.enabled(user)) return
  if ((await security.policy()).requireTwoStep) {
    throw apiError(403, 'ERR_TWO_STEP_REQUIRED', 'Turn on two-step sign-in to keep using the Admin Panel.')
  }
}

/** The signed-in admin (set by AdminGuard). */
export const CurrentAdmin = createParamDecorator((_d: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AdminRequest>().admin as AdminSession
})
