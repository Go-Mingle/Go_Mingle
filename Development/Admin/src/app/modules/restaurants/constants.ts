import type { RestaurantDirectoryStatus } from './restaurantApi.types'

export const RESTAURANTS_ENDPOINTS = {
  list: '/api/v1/restaurants',
  byId: (id: string) => `/api/v1/restaurants/${id}`,
  suspend: (id: string) => `/api/v1/restaurants/${id}/suspend`,
  unsuspend: (id: string) => `/api/v1/restaurants/${id}/unsuspend`,
  activeBookingsCount: (id: string) => `/api/v1/restaurants/${id}/bookings/count-active`,
  contacts: (id: string) => `/api/v1/restaurants/${id}/contacts`,
  tables: (id: string) => `/api/v1/restaurants/${id}/tables`,
  menuOptions: (id: string) => `/api/v1/restaurants/${id}/menu-options`,
  amenities: (id: string) => `/api/v1/restaurants/${id}/amenities`,
  media: (id: string) => `/api/v1/restaurants/${id}/media`,
  changeCategory: (id: string) => `/api/v1/restaurants/${id}/category`,
  reviews: (rid: string) => `/api/v1/restaurants/${rid}/reviews`,
  reviewById: (id: string) => `/api/v1/reviews/${id}`,
  interestTableLookup: (rid: string) => `/api/v1/restaurants/${rid}/lookups/interest-tables`,
  adminBookings: '/api/v1/admin/bookings',
  adminBookingById: (id: string) => `/api/v1/admin/bookings/${id}`,
  activeCategories: '/api/v1/categories/active',
} as const

/**
 * CR-45 — the only statuses the directory serves, and the only values
 * `statuses[]` accepts. Drives both the Status column's filter options and the
 * `ListRestaurantsParams` type, so the UI cannot offer a value the API 422s on.
 */
export const DIRECTORY_STATUSES: readonly RestaurantDirectoryStatus[] = ['ACTIVE', 'SUSPENDED']

export const RESTAURANTS_PAGE_SIZE = 10
export const RESTAURANTS_MOBILE_PAGE_SIZE = 5
export const REVIEWS_PAGE_SIZE = 10
export const BOOKINGS_PAGE_SIZE = 10

// Re-export legacy palette/labels from their origin (used widely across components)
export { categoryColors, statusColors, statusLabels } from './components/restaurantsPage.types'
