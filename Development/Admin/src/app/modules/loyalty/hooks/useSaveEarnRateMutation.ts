import { useMutation, useQueryClient } from '@tanstack/react-query'
import { loyaltyService } from '../services'
import type { UpdateEarnRatePayload } from '../types'
import { LOYALTY_QUERY_KEY } from './useLoyaltyConfigurationQuery'

export function useSaveEarnRateMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateEarnRatePayload) => loyaltyService.saveEarnRate(payload),
    onSuccess: (data) => {
      qc.setQueryData(LOYALTY_QUERY_KEY, data)
    },
  })
}
