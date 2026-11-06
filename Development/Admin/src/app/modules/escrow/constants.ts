export const ESCROW_ENDPOINTS = {
  overview: '/api/v1/escrow',
  testBooking: '/api/v1/escrow/test-booking',
  action: (id: string, action: string) => `/api/v1/escrow/${encodeURIComponent(id)}/${action}`,
} as const

export const ESCROW_QUERY_KEY = ['escrow'] as const
