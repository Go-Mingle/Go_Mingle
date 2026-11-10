export const AMENITIES_ENDPOINTS = {
  list: '/api/v1/amenities',
  active: '/api/v1/amenities/active',
  byId: (id: string) => `/api/v1/amenities/${id}`,
} as const

export const DEFAULT_AMENITY_ICON = 'ShieldCheck'
