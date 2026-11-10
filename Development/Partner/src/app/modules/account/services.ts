import { httpClient } from '../../../shared/api/httpClient'
import { ACCOUNT_ENDPOINTS } from './constants'
import type { PartnerProfile, UpdatePartnerProfileDto } from './types'

export const accountService = {
  /** The signed-in partner's profile — email, name, designation (US-05). */
  getMe: (): Promise<PartnerProfile> => httpClient.get<PartnerProfile>(ACCOUNT_ENDPOINTS.me),

  /**
   * Updates the signed-in partner only, never another user's record. Returns the
   * updated profile in the same shape as the GET, so the caller applies the
   * response directly rather than refetching.
   */
  updateMe: (data: UpdatePartnerProfileDto): Promise<PartnerProfile> =>
    httpClient.patch<PartnerProfile>(ACCOUNT_ENDPOINTS.me, data),
}
