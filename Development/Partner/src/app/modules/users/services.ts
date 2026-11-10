import { httpClient } from '../../../shared/api/httpClient'
import { buildUsersQueryString } from './adapters'
import { PARTNER_USERS_ENDPOINTS } from './constants'
import type {
  CreatePartnerUserDto,
  CreatePartnerUserResponse,
  PartnerUserListItem,
  PartnerUsersPage,
  PartnerUsersQueryParams,
  SetPartnerUserPasswordDto,
  UpdatePartnerUserDto,
} from './types'

/**
 * J3's five endpoints. Every one is scoped to the caller's restaurant by the
 * backend from the access token, so no restaurant id is ever sent.
 *
 * A target outside the caller's scope — including the caller's own id — comes
 * back as 404, never 403: a 403 would confirm the row exists.
 */
export const partnerUsersService = {
  /** The grid (US-01). Server-side paginated, sorted, searched and filtered. */
  list: (params: PartnerUsersQueryParams = {}): Promise<PartnerUsersPage> =>
    httpClient.get<PartnerUsersPage>(
      `${PARTNER_USERS_ENDPOINTS.list}${buildUsersQueryString(params)}`,
    ),

  /**
   * Creates a sub-user and emails them their login email and password (US-02).
   * Re-using a soft-deleted user's email revives that record instead of
   * duplicating, flagged by `reactivated` on the response (BR-12).
   */
  create: (data: CreatePartnerUserDto): Promise<CreatePartnerUserResponse> =>
    httpClient.post<CreatePartnerUserResponse>(PARTNER_USERS_ENDPOINTS.list, data),

  /**
   * Edits name, designation and status (US-03) — and so is also how a user is
   * suspended or activated (US-05); there is no separate endpoint for that.
   */
  update: (id: string, data: UpdatePartnerUserDto): Promise<PartnerUserListItem> =>
    httpClient.patch<PartnerUserListItem>(PARTNER_USERS_ENDPOINTS.byId(id), data),

  /** Sets another user's password silently — no email is sent (US-04, BR-07). */
  setPassword: (id: string, data: SetPartnerUserPasswordDto): Promise<{ passwordSet: boolean }> =>
    httpClient.post<{ passwordSet: boolean }>(PARTNER_USERS_ENDPOINTS.setPassword(id), data),

  /** Soft delete (US-06) — the record is retained; the user loses access. */
  remove: (id: string): Promise<{ deleted: boolean }> =>
    httpClient.delete<{ deleted: boolean }>(PARTNER_USERS_ENDPOINTS.byId(id)),
}
