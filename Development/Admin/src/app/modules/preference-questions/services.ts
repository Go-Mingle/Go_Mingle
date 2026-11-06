import { httpClient } from '../../../shared/api/httpClient'
import { PREFERENCE_QUESTIONS_ENDPOINTS } from './constants'
import type {
  ListPreferenceQuestionsParams,
  PreferenceQuestionsListData,
  PreferenceQuestionDetail,
  CreatePreferenceQuestionInput,
  UpdatePreferenceQuestionInput,
  PreferenceQuestionMutationResult,
} from './types'

export const preferenceQuestionsService = {
  list: (params?: ListPreferenceQuestionsParams): Promise<PreferenceQuestionsListData> => {
    const sp = new URLSearchParams()
    if (params?.page !== undefined) sp.set('page', String(params.page))
    if (params?.pageSize !== undefined) sp.set('pageSize', String(params.pageSize))
    if (params?.sortBy) sp.set('sortBy', params.sortBy)
    if (params?.sortOrder) sp.set('sortOrder', params.sortOrder)
    if (params?.q) sp.set('q', params.q)
    const qs = sp.toString()
    return httpClient.get<PreferenceQuestionsListData>(
      qs ? `${PREFERENCE_QUESTIONS_ENDPOINTS.list}?${qs}` : PREFERENCE_QUESTIONS_ENDPOINTS.list,
    )
  },

  getById: (id: string): Promise<PreferenceQuestionDetail> =>
    httpClient.get<PreferenceQuestionDetail>(PREFERENCE_QUESTIONS_ENDPOINTS.byId(id)),

  create: (input: CreatePreferenceQuestionInput): Promise<PreferenceQuestionMutationResult> =>
    httpClient.post<PreferenceQuestionMutationResult>(PREFERENCE_QUESTIONS_ENDPOINTS.list, input),

  update: (
    id: string,
    input: UpdatePreferenceQuestionInput,
  ): Promise<PreferenceQuestionMutationResult> =>
    httpClient.patch<PreferenceQuestionMutationResult>(
      PREFERENCE_QUESTIONS_ENDPOINTS.byId(id),
      input,
    ),

  remove: (id: string): Promise<void> =>
    httpClient.delete<void>(PREFERENCE_QUESTIONS_ENDPOINTS.byId(id)),
}
