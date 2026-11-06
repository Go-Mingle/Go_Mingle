import { httpClient } from '../../../../shared/api/httpClient'
import { PAYOUT_ACCOUNT_ENDPOINT } from './constants'
import type { PayoutAccountResponse, SavePayoutAccountDto } from './types'

export const payoutAccountService = {
  get: (): Promise<PayoutAccountResponse> => httpClient.get<PayoutAccountResponse>(PAYOUT_ACCOUNT_ENDPOINT),
  save: (body: SavePayoutAccountDto): Promise<PayoutAccountResponse> =>
    httpClient.put<PayoutAccountResponse>(PAYOUT_ACCOUNT_ENDPOINT, body),
}
