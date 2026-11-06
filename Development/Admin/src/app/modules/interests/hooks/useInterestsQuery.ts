import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { interestsService } from '../services'
import type { CreateInterestDto, UpdateInterestDto, InterestsListParams } from '../types'

/**
 * Paginated interests list. The params are part of the query key, so changing
 * the page or the page size issues a fresh request; `keepPreviousData` holds the
 * current rows on screen while it resolves instead of flashing the spinner.
 */
export function useInterestsQuery(params: InterestsListParams = {}) {
  return useQuery({
    queryKey: ['interests', 'list', params],
    queryFn: () => interestsService.getAll(params),
    placeholderData: keepPreviousData,
  })
}

/** Active interests — sources the create form's "interest category" dropdown. */
export function useActiveInterestsQuery() {
  return useQuery({
    queryKey: ['interests', 'active'],
    queryFn: () => interestsService.getActive(),
  })
}

/** Fetch a single interest — powers the edit modal's detail load. */
export function useInterestQuery(id: string | null) {
  return useQuery({
    queryKey: ['interests', id],
    queryFn: () => interestsService.getById(id as string),
    enabled: !!id,
  })
}

export function useCreateInterestMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateInterestDto) => interestsService.create(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['interests'] })
    },
  })
}

export function useUpdateInterestMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInterestDto }) =>
      interestsService.update(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['interests'] })
    },
  })
}

export function useDeleteInterestMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => interestsService.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['interests'] })
    },
  })
}
