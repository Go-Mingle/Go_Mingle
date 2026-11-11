export const ESCROW_ENDPOINTS = {
  overview: '/api/v1/escrow',
  testBooking: '/api/v1/escrow/test-booking',
  /** A sandbox booking at an interest table, under the restaurant's no-show policy. */
  tableBooking: '/api/v1/admin/bookings/sandbox',
  interestTables: (restaurantId: string) =>
    `/api/v1/restaurants/${encodeURIComponent(restaurantId)}/lookups/interest-tables`,
  /** TEMPORARY (GM-255): admin completes the card step with a test card. */
  testCard: (id: string) => `/api/v1/escrow/${encodeURIComponent(id)}/test-card`,
  /** The card step on Safepay's own checkout page (needs Safepay keys). */
  checkout: (id: string) => `/api/v1/escrow/${encodeURIComponent(id)}/checkout`,
  confirmCheckout: (id: string) => `/api/v1/escrow/${encodeURIComponent(id)}/checkout/confirm`,
  retryFailure: (id: number) => `/api/v1/escrow/failures/${id}/retry`,
  resolveFailure: (id: number) => `/api/v1/escrow/failures/${id}/resolve`,
  action: (id: string, action: string) => `/api/v1/escrow/${encodeURIComponent(id)}/${action}`,
} as const

export const ESCROW_QUERY_KEY = ['escrow'] as const

/** Where Safepay sends the payer back to: this page, naming the hold that was paid for. */
export const CHECKOUT_RETURN_PARAM = 'checkout'
