import { CanActivate, createParamDecorator, ExecutionContext, Injectable } from '@nestjs/common'
import type { Request } from 'express'
import { apiError } from '../../common/errors'
import { ADMIN_AUDIENCE, bearer, PARTNER_AUDIENCE, TokensService } from '../../auth/tokens.service'
import { AdminAccountsService, type AdminSession } from '../../admin/access/admin-accounts.service'
import { RestaurantsService } from '../../shared/restaurants/restaurants.service'
import { PartnerAccountsService, type PartnerUser } from './partner-accounts.service'

export type PartnerRequest = Request & { partner?: PartnerUser; actingAdmin?: AdminSession }

/**
 * A GoMingle admin managing a restaurant's own screens (GM-342): an admin
 * access token plus this header naming the restaurant. The request then runs
 * through the Partner endpoints with every business rule they already have.
 */
export const ACT_AS_HEADER = 'x-gomingle-restaurant'

/** Only the restaurant's profile, contacts, tables, menus, amenities and media. */
const ACT_AS_PATHS = /^\/partner\/api\/v1\/partner\/restaurant(\/|$)/

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
    private readonly admins: AdminAccountsService,
    private readonly restaurants: RestaurantsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<PartnerRequest>()
    const restaurantId = req.header(ACT_AS_HEADER)
    req.partner = restaurantId ? await this.actAs(req, restaurantId) : await resolvePartner(req, this.tokens, this.accounts)
    return true
  }

  /** A stand-in owner of the restaurant, for an admin allowed to manage restaurants. */
  private async actAs(req: PartnerRequest, restaurantId: string): Promise<PartnerUser> {
    if (!ACT_AS_PATHS.test(req.path)) throw apiError(403, 'ERR_FORBIDDEN', 'Not available to GoMingle admins.')
    const { claims, error } = this.tokens.verify(bearer(req), ADMIN_AUDIENCE)
    if (!claims) throw apiError(401, error ?? 'ERR_TOKEN_INVALID', 'Authentication required')
    const admin = await this.admins.byId(claims.sub)
    if (!admin) throw apiError(401, 'ERR_TOKEN_INVALID', 'Unknown user')
    if (admin.status !== 'ACTIVE') throw apiError(403, 'ERR_ACCOUNT_SUSPENDED', 'Account suspended')
    const role = admin.role
    if (!role || !(role.fullAccess || role.permissions.includes('RESTAURANTS'))) {
      throw apiError(403, 'ERR_FORBIDDEN', 'Your role cannot manage restaurants.')
    }
    const restaurant = await this.restaurants.find(restaurantId)
    if (!restaurant) throw apiError(404, 'ERR_NOT_FOUND', 'Restaurant not found.')
    req.actingAdmin = admin
    return {
      id: `admin:${admin.id}`,
      seq: 0,
      restaurantId,
      email: admin.email,
      fullName: `${admin.fullName} (GoMingle)`,
      designation: 'GoMingle admin',
      status: 'ACTIVE',
      isPrimary: true,
      lastActiveAt: null,
      createdAt: new Date().toISOString(),
      passwordHash: null,
      failures: 0,
      lockedUntil: 0,
      googleSub: null,
    }
  }
}

/** The signed-in partner user (set by PartnerGuard). */
export const CurrentPartner = createParamDecorator((_d: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<PartnerRequest>().partner as PartnerUser
})
