import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { partnerRetryPolicy } from '../../../../../shared/api/retryPolicy'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { PARTNER_SESSION_QUERY_KEY } from '../../../session/constants'
import { PARTNER_PROFILE_QUERY_KEY } from '../../partnerProfile/constants'
import { PAYOUT_ACCOUNT_QUERY_KEY } from '../constants'
import { payoutAccountService } from '../services'
import type { PayoutAccountResponse, SavePayoutAccountDto } from '../types'

export function usePayoutAccountQuery() {
  return useQuery<PayoutAccountResponse>({
    queryKey: PAYOUT_ACCOUNT_QUERY_KEY,
    queryFn: payoutAccountService.get,
    enabled: tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

/**
 * Saving writes the account into the cache and refetches the profile and
 * session: the profile's `submissionReadiness.payoutConfigured` is what enables
 * "Send for Approval", and the session carries `payoutReady`.
 */
export function useSavePayoutAccountMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SavePayoutAccountDto) => payoutAccountService.save(body),
    onSuccess: (data) => {
      qc.setQueryData(PAYOUT_ACCOUNT_QUERY_KEY, data)
      void qc.invalidateQueries({ queryKey: PARTNER_PROFILE_QUERY_KEY, exact: true })
      void qc.invalidateQueries({ queryKey: PARTNER_SESSION_QUERY_KEY })
    },
  })
}
