import { CanActivate, createParamDecorator, ExecutionContext, Injectable } from '@nestjs/common'
import type { Request } from 'express'
import { apiError } from '../../common/errors'
import { ADMIN_AUDIENCE, bearer, TokensService } from '../../auth/tokens.service'
import { AdminAccountsService, type AdminSession } from './admin-accounts.service'

export type AdminRequest = Request & { admin?: AdminSession }

/**
 * Admin Panel routes: a valid admin access token for an ACTIVE account.
 * 401 ERR_TOKEN_EXPIRED / ERR_TOKEN_INVALID, 403 ERR_ACCOUNT_SUSPENDED.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly tokens: TokensService,
    private readonly accounts: AdminAccountsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>()
    req.admin = await resolveAdmin(req, this.tokens, this.accounts)
    return true
  }
}

/** The signed-in admin for a request; throws the portal's auth errors. */
export async function resolveAdmin(req: Request, tokens: TokensService, accounts: AdminAccountsService): Promise<AdminSession> {
  const { claims, error } = tokens.verify(bearer(req), ADMIN_AUDIENCE)
  if (!claims) throw apiError(401, error ?? 'ERR_TOKEN_INVALID', 'Authentication required')
  const user = await accounts.byId(claims.sub)
  if (!user) throw apiError(401, 'ERR_TOKEN_INVALID', 'Unknown user')
  if (user.status !== 'ACTIVE') throw apiError(403, 'ERR_ACCOUNT_SUSPENDED', 'Account suspended')
  return user
}

/** The signed-in admin (set by AdminGuard). */
export const CurrentAdmin = createParamDecorator((_d: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AdminRequest>().admin as AdminSession
})
