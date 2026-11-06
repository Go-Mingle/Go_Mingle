export const CHANGE_LOG_ENDPOINTS = {
  list: '/api/v1/change-log',
  detail: (id: string) => `/api/v1/change-log/${id}`,
} as const

export const CHANGE_LOG_PAGE_SIZE = 10
export const CHANGE_LOG_MOBILE_PAGE_SIZE = 5

export const ACTION_TYPES = {
  create: 'create',
  update: 'update',
  delete: 'delete',
} as const

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES]
