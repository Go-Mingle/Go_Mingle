import { useQuery } from '@tanstack/react-query'
import { loyaltyService } from '../services'

export const LOYALTY_QUERY_KEY = ['loyalty-configuration'] as const

export function useLoyaltyConfigurationQuery() {
  return useQuery({
    queryKey: LOYALTY_QUERY_KEY,
    queryFn: () => loyaltyService.getCurrent(),
  })
}
