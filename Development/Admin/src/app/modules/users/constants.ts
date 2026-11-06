export const USERS_ENDPOINTS = {
  list: '/api/v1/users',
  byId: (id: string) => `/api/v1/users/${id}`,
  changePassword: (id: string) => `/api/v1/users/${id}/change-password`,
} as const

export const USERS_PAGE_SIZE = 25
export const USERS_MOBILE_PAGE_SIZE = 5
export const PASSWORD_RESET_MIN_LENGTH = 8
