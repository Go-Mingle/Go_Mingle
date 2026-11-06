/**
 * J6A Restaurant Profile (Partner Portal).
 *
 * Nine client-callable endpoints. The tenth — the inbound Safepay
 * `account.updated` webhook — is server-to-server and deliberately absent here.
 *
 * No restaurant id appears on any route: it is resolved from the access token
 * (F1 BR-04), and J6A accepts none from the client.
 */
export const PARTNER_PROFILE_ENDPOINTS = {
  restaurant: '/api/v1/partner/restaurant',
  submit: '/api/v1/partner/restaurant/submit',
  saveDraft: '/api/v1/partner/restaurant/save-draft',
  onboardingLink: '/api/v1/partner/restaurant/payments/onboarding-link',
  contacts: '/api/v1/partner/restaurant/contacts',
  contactById: (contactId: string) => `/api/v1/partner/restaurant/contacts/${contactId}`,
} as const

export const PARTNER_PROFILE_QUERY_KEY = ['partner', 'restaurant'] as const
export const PARTNER_CONTACTS_QUERY_KEY = ['partner', 'restaurant', 'contacts'] as const

/**
 * Field limits (spec §5).
 *
 * Dress Code is 200, matching both places the spec fixes it: the field table
 * (`≤200 chars`) and the J6A payload contract (`rules.dressCode — string —
 * ≤200`). It previously read 150 on the belief that the column was
 * `varchar(150)`; nothing in this repo or the contract supports that, so the
 * client no longer truncates 50 characters the spec allows (MET-1248).
 */
export const PROFILE_LIMITS = {
  name: 100,
  cuisine: 100,
  description: 600,
  fullAddress: 300,
  areaDistrict: 100,
  city: 100,
  ownerName: 100,
  houseRules: 500,
  dressCode: 200,
  contactName: 100,
  contactTitle: 100,
} as const

/**
 * Which Overview card owns each mandatory-for-submission field.
 *
 * A failed submit names the gaps in `missingFields`; this is what turns those
 * names into "which card do I open" (AC-07.3). `name` belongs to the header
 * modal, not a card, so it is deliberately absent.
 */
export const FIELD_TO_CARD = {
  cuisine: 'details',
  description: 'details',
  fullAddress: 'location',
  areaDistrict: 'location',
  city: 'location',
  gpsLocation: 'location',
  restaurantPhone: 'location',
  restaurantEmail: 'location',
  ownerName: 'owner',
  ownerPhone: 'owner',
  ownerEmail: 'owner',
} as const

/**
 * How the client waits for Safepay's webhook after a return.
 *
 * Bounded deliberately: an incomplete verification may never confirm, and an
 * unbounded poll would run for as long as the page stays open.
 */
export const PAYMENTS_CONFIRM_INTERVAL_MS = 4000
export const PAYMENTS_CONFIRM_ATTEMPTS = 5

/** Contacts list params (endpoint 3). A bad value is a 422, not a silent default. */
export const CONTACT_SORT_FIELDS = ['name', 'title', 'email', 'phone'] as const
export const CONTACT_SEARCH_FIELDS = ['name', 'title', 'email', 'phone'] as const

/**
 * Where Safepay sends the partner back. Our profile page is `/overview` — the
 * backend's own note assumed `/restaurant-profile`, so these are the two paths
 * they need in their constants.
 *
 * `refresh` is not an error page: Safepay AccountLinks are single-use and
 * short-lived, so it fires routinely and must mint a new link and redirect.
 */
export const PAYMENTS_RETURN_PATH = '/overview?payments=return'
export const PAYMENTS_REFRESH_PATH = '/overview?payments=refresh'
export const PAYMENTS_QUERY_PARAM = 'payments'

/** J6A-specific error codes (spec §4.3). */
export const PROFILE_ERROR_CODES = {
  READ_ONLY: 'ERR_PROFILE_READ_ONLY',
  LAST_CONTACT: 'ERR_LAST_CONTACT',
  INVALID_STATE: 'ERR_INVALID_STATE',
  COVER_PHOTO_REQUIRED: 'ERR_COVER_PHOTO_REQUIRED',
  PAYMENT_SEAM: 'ERR_PAYMENT_SEAM',
} as const
