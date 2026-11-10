import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { financesService } from '../services'
import type { ListFinancesQueryParams } from '../types'

export function useFinancesQuery(params: ListFinancesQueryParams = {}) {
  return useQuery({
    queryKey: ['finances', params],
    queryFn: () => financesService.getAll(params),
    placeholderData: keepPreviousData,
  })
}

export function useFinanceDetailQuery(bookingId: string | null) {
  return useQuery({
    queryKey: ['finances', 'detail', bookingId],
    queryFn: () => financesService.getDetail(bookingId!),
    enabled: !!bookingId,
  })
}
