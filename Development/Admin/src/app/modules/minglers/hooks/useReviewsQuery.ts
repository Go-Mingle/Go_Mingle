import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { reviewsService } from '../services'
import type { ListReviewsQueryParams } from '../types'

/** Mingler-filtered reviews list (server-side search/filter/sort/pagination). */
export function useMinglerReviewsQuery(params: ListReviewsQueryParams, enabled = true) {
  return useQuery({
    queryKey: ['reviews', params],
    queryFn: () => reviewsService.getAll(params),
    enabled: enabled && !!params.minglerId,
    placeholderData: keepPreviousData,
  })
}

/** Single review detail; only fetched while the detail modal is open. */
export function useReviewDetailQuery(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['review', id],
    queryFn: () => reviewsService.getById(id!),
    enabled: enabled && !!id,
  })
}

export function useDeleteReviewMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => reviewsService.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reviews'] })
    },
  })
}
