import { httpClient } from '../../../shared/api/httpClient'
import type {
  LoyaltyConfigurationData,
  UpdateEarnRatePayload,
  UpdateRedeemRatePayload,
} from './types'
import { LOYALTY_ENDPOINTS } from './constants'

export const loyaltyService = {
  getCurrent: (): Promise<LoyaltyConfigurationData> => httpClient.get(LOYALTY_ENDPOINTS.current),

  saveEarnRate: (data: UpdateEarnRatePayload): Promise<LoyaltyConfigurationData> =>
    httpClient.patch(LOYALTY_ENDPOINTS.earnRate, data),

  saveRedeemRate: (data: UpdateRedeemRatePayload): Promise<LoyaltyConfigurationData> =>
    httpClient.patch(LOYALTY_ENDPOINTS.redeemRate, data),
}
