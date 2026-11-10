import { CanActivate, createParamDecorator, ExecutionContext, Injectable } from '@nestjs/common'
import type { Request } from 'express'
import { apiError } from '../../common/errors'
import { bearer, PARTNER_AUDIENCE, TokensService } from '../../auth/tokens.service'
import { PartnerAccountsService, type PartnerUser } from './partner-accounts.service'

export type PartnerRequest = Request & { partner?: PartnerUser }

/** The signed-in partner for a request; throws the portal's auth errors. */
export async function resolvePartner(req: Request, tokens: TokensService, accounts: PartnerAccountsService): Promise<PartnerUser> {
  const { claims, error } = tokens.verify(bearer(req), PARTNER_AUDIENCE)
  if (!claims) throw apiError(401, error ?? 'ERR_TOKEN_INVALID', 'Authentication required')
  const user = await accounts.byId(claims.sub)
  if (!user) throw apiError(401, 'ERR_TOKEN_INVALID', 'Unknown user')
  if (user.status !== 'ACTIVE') throw apiError(403, 'ERR_ACCOUNT_SUSPENDED', 'Account suspended')
  return user
}

/** Partner Portal routes: a valid partner access token for an ACTIVE account. */
@Injectable()
export class PartnerGuard implements CanActivate {
  constructor(
    private readonly tokens: TokensService,
    private readonly accounts: PartnerAccountsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<PartnerRequest>()
    req.partner = await resolvePartner(req, this.tokens, this.accounts)
    return true
  }
}

/** The signed-in partner user (set by PartnerGuard). */
export const CurrentPartner = createParamDecorator((_d: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<PartnerRequest>().partner as PartnerUser
})
