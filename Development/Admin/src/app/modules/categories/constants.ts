export const CATEGORIES_ENDPOINTS = {
  list: '/api/v1/categories',
  active: '/api/v1/categories/active',
  byId: (id: string) => `/api/v1/categories/${id}`,
} as const

export const CATEGORIES_PAGE_SIZE = 10
export const COMMISSION_MAX_PERCENT = 100
export const PENALTY_MAX_PERCENT = 100
