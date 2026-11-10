import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { interestTopicsService } from '../services'
import type { TopicListParams, CreateTopicRequest, UpdateTopicRequest } from '../types'

export function useTopicsList(params: TopicListParams) {
  return useQuery({
    queryKey: ['interest-topics', params],
    queryFn: () => interestTopicsService.list(params),
  })
}

export function useActiveTopicsList() {
  return useQuery({
    queryKey: ['interest-topics', 'active'],
    queryFn: () => interestTopicsService.listActive(),
  })
}

export function useTopicDetail(id: string | null) {
  return useQuery({
    queryKey: ['interest-topic', id],
    queryFn: () => interestTopicsService.getById(id!),
    enabled: !!id,
  })
}

export function useTopicSave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: CreateTopicRequest | UpdateTopicRequest }) =>
      id
        ? interestTopicsService.update(id, data as UpdateTopicRequest)
        : interestTopicsService.create(data as CreateTopicRequest),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['interest-topics'] })
      // Keep the detail cache fresh so a re-edit after save refetches.
      void qc.invalidateQueries({ queryKey: ['interest-topic'] })
    },
  })
}

export function useTopicDelete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => interestTopicsService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interest-topics'] }),
  })
}
