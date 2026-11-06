/** Max length (after trim) for a mingler directory search term; mirrors backend @MaxLength(100). */
export const MINGLER_SEARCH_MAX_LENGTH = 100

export const MINGLERS_ENDPOINTS = {
  list: '/api/v1/minglers',
  byId: (id: string) => `/api/v1/minglers/${id}`,
  suspend: (id: string) => `/api/v1/minglers/${id}/suspend`,
  reactivate: (id: string) => `/api/v1/minglers/${id}/reactivate`,
  activeBookingsCount: (id: string) => `/api/v1/minglers/${id}/bookings/count-active`,
  promingler: (id: string) => `/api/v1/minglers/${id}/promingler`,
  eatingPreferences: (id: string) => `/api/v1/minglers/${id}/eating-preferences`,
  paymentMethods: (id: string) => `/api/v1/minglers/${id}/payment-methods`,
  setDefaultPaymentMethod: (id: string, pmId: string) =>
    `/api/v1/minglers/${id}/payment-methods/${pmId}/set-default`,
} as const

export const ADMIN_BOOKINGS_ENDPOINT = '/api/v1/admin/bookings'
/** Admin-cancel a single booking (J10C / CR-010 refund-or-release cascade runs server-side). */
export const adminBookingCancelEndpoint = (id: string) => `${ADMIN_BOOKINGS_ENDPOINT}/${id}/cancel`

export const REVIEWS_ENDPOINTS = {
  /** Mingler-filtered reviews list (owned by J10D). */
  adminList: '/api/v1/admin/reviews',
  byId: (id: string) => `/api/v1/reviews/${id}`,
} as const

// Re-export constants from their origin for canonical access
export {
  HERO_STATUS_CONFIG,
  BOOKING_STATUS_COLORS,
  BOOKING_STATUS_LABELS,
  AVATAR_PALETTE,
} from './components/utils'
export { SIGN_UP_QUESTIONS } from './components/signUpQuestions'
export type { SignUpQuestion } from './components/signUpQuestions'
