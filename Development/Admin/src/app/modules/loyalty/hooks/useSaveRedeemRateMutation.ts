import { useMutation, useQueryClient } from '@tanstack/react-query'
import { loyaltyService } from '../services'
import type { UpdateRedeemRatePayload } from '../types'
import { LOYALTY_QUERY_KEY } from './useLoyaltyConfigurationQuery'

export function useSaveRedeemRateMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateRedeemRatePayload) => loyaltyService.saveRedeemRate(payload),
    onSuccess: (data) => {
      qc.setQueryData(LOYALTY_QUERY_KEY, data)
    },
  })
}
