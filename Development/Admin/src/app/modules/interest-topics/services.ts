import { httpClient } from '../../../shared/api/httpClient'
import type {
  InterestTopic,
  TopicListResponse,
  TopicListParams,
  ActiveTopicsResponse,
  CreateTopicRequest,
  UpdateTopicRequest,
} from './types'
import { INTEREST_TOPICS_ENDPOINTS } from './constants'

export type { CreateTopicRequest, UpdateTopicRequest }

export const interestTopicsService = {
  list: (params?: TopicListParams): Promise<TopicListResponse> => {
    const qs = new URLSearchParams()
    if (params?.page !== undefined) qs.set('page', String(params.page))
    if (params?.pageSize !== undefined) qs.set('pageSize', String(params.pageSize))
    if (params?.q) qs.set('q', params.q)
    if (params?.sortBy) qs.set('sortBy', params.sortBy)
    if (params?.sortOrder) qs.set('sortOrder', params.sortOrder)
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return httpClient.get<TopicListResponse>(`${INTEREST_TOPICS_ENDPOINTS.list}${suffix}`)
  },

  listActive: (): Promise<ActiveTopicsResponse> =>
    httpClient.get<ActiveTopicsResponse>(INTEREST_TOPICS_ENDPOINTS.active),

  getById: (id: string): Promise<InterestTopic> =>
    httpClient.get<InterestTopic>(INTEREST_TOPICS_ENDPOINTS.byId(id)),

  create: (data: CreateTopicRequest): Promise<InterestTopic> =>
    httpClient.post<InterestTopic>(INTEREST_TOPICS_ENDPOINTS.list, data),

  update: (id: string, data: UpdateTopicRequest): Promise<InterestTopic> =>
    httpClient.patch<InterestTopic>(INTEREST_TOPICS_ENDPOINTS.byId(id), data),

  delete: (id: string): Promise<void> =>
    httpClient.delete<void>(INTEREST_TOPICS_ENDPOINTS.byId(id)),
}
