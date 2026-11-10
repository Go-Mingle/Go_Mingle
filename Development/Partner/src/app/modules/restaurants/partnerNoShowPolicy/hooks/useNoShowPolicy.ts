import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { partnerRetryPolicy } from '../../../../../shared/api/retryPolicy'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { NO_SHOW_POLICY_QUERY_KEY } from '../constants'
import { noShowPolicyService } from '../services'
import type { NoShowPolicy, SaveNoShowPolicyDto } from '../types'

export function useNoShowPolicyQuery() {
  return useQuery<NoShowPolicy>({
    queryKey: NO_SHOW_POLICY_QUERY_KEY,
    queryFn: noShowPolicyService.get,
    enabled: tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

/** The saved policy goes straight into the cache; nothing else depends on it. */
export function useSaveNoShowPolicyMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SaveNoShowPolicyDto) => noShowPolicyService.save(body),
    onSuccess: (data) => {
      qc.setQueryData(NO_SHOW_POLICY_QUERY_KEY, data)
    },
  })
}
