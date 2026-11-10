export const INTEREST_TOPICS_ENDPOINTS = {
  list: '/api/v1/topics',
  active: '/api/v1/topics/active',
  byId: (id: string) => `/api/v1/topics/${id}`,
} as const

export const INTEREST_TOPICS_PAGE_SIZE = 10
export const DESCRIPTION_MAX_LENGTH = 500
