import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { preferenceQuestionsService } from '../services'
import type {
  ListPreferenceQuestionsParams,
  CreatePreferenceQuestionInput,
  UpdatePreferenceQuestionInput,
} from '../types'

export function usePreferenceQuestionsQuery(params: ListPreferenceQuestionsParams = {}) {
  return useQuery({
    queryKey: ['preference-questions', params],
    queryFn: () => preferenceQuestionsService.list(params),
    placeholderData: keepPreviousData,
  })
}

export function useGetPreferenceQuestionQuery(id: string | null) {
  return useQuery({
    queryKey: ['preference-questions', id],
    queryFn: () => preferenceQuestionsService.getById(id!),
    enabled: !!id,
  })
}

export function useCreatePreferenceQuestionMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePreferenceQuestionInput) => preferenceQuestionsService.create(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['preference-questions'] })
    },
  })
}

export function useUpdatePreferenceQuestionMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePreferenceQuestionInput }) =>
      preferenceQuestionsService.update(id, data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: ['preference-questions'] })
      void qc.invalidateQueries({ queryKey: ['preference-questions', id] })
    },
  })
}

export function useDeletePreferenceQuestionMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => preferenceQuestionsService.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['preference-questions'] })
    },
  })
}
