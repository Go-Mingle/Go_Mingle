export interface Interest {
  id: string
  name: string
}

export interface InterestTopic {
  id: string
  name: string
  description: string | null
  graphicUrl: string | null
  interests: Interest[]
  interestTablesCount: number
  createdAt: string
}

export interface TopicListResponse {
  items: InterestTopic[]
  pagination: {
    page: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

/** Lightweight active-topic item returned by GET /api/v1/topics/active (dropdown source). */
export interface ActiveTopic {
  id: string
  name: string
  graphicUrl: string | null
}

export interface ActiveTopicsResponse {
  items: ActiveTopic[]
}

export interface CreateTopicRequest {
  name: string
  description?: string
  /** Storage key from the signed-url upload (FileStorageService); backend resolves it to graphicUrl. */
  graphicKey?: string
  interestIds: string[]
}

export type UpdateTopicRequest = Partial<CreateTopicRequest>

export interface TopicListParams {
  page?: number
  pageSize?: number
  q?: string
  sortBy?: 'name'
  sortOrder?: 'asc' | 'desc'
}

export interface InterestTopicFormValues {
  name: string
  description?: string
  graphicUrl?: string
  interestIds: string[]
}
