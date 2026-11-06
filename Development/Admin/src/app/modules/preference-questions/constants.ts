export const PREFERENCE_QUESTIONS_ENDPOINTS = {
  list: '/api/v1/preference-questions',
  active: '/api/v1/preference-questions/active',
  byId: (id: string) => `/api/v1/preference-questions/${id}`,
} as const

export const PREFERENCE_QUESTIONS_PAGE_SIZE = 10
