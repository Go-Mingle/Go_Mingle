/**
 * J6F Restaurant Profile — Interest Tables (Partner Portal).
 *
 * Nine client-callable endpoints over J10B's `interest_tables` /
 * `interest_table_invitees` / `interest_table_menu_options` and J10C's `bookings`.
 * J6F is a **read-only mirror** of the admin views: the partner cannot create,
 * edit, cancel, or reschedule an interest table (BR-02). The only two mutations
 * are cancelling a booking and cancelling an invite.
 *
 * No restaurant id appears on any route — it is resolved from the access token
 * (F1 BR-04), same as J6A–J6E.
 */
const ROOT = '/api/v1/partner'

export const PARTNER_IT_ENDPOINTS = {
  interestTables: `${ROOT}/interest-tables`,
  interestTableById: (itId: string) => `${ROOT}/interest-tables/${itId}`,
  menuOptions: (itId: string) => `${ROOT}/interest-tables/${itId}/menu-options`,
  bookings: (itId: string) => `${ROOT}/interest-tables/${itId}/bookings`,
  invitees: (itId: string) => `${ROOT}/interest-tables/${itId}/invitees`,
  cancelInvite: (itId: string, inviteeId: string) =>
    `${ROOT}/interest-tables/${itId}/invitees/${inviteeId}/cancel`,
  guestsArrived: (itId: string) => `${ROOT}/interest-tables/${itId}/guests-arrived`,
  markNoShow: (bookingId: string) => `${ROOT}/bookings/${bookingId}/no-show`,
  bookingById: (bookingId: string) => `${ROOT}/bookings/${bookingId}`,
  cancelBooking: (bookingId: string) => `${ROOT}/bookings/${bookingId}/cancel`,
  minglerById: (minglerId: string) => `${ROOT}/minglers/${minglerId}`,
} as const

/**
 * Query keys.
 *
 * The list is keyed with its params so each page and filter combination caches
 * separately; the per-table reads hang off the interest-table id.
 */
export const PARTNER_IT_QUERY_KEY = ['partner', 'interest-tables'] as const
export const partnerITDetailKey = (itId: string) => [...PARTNER_IT_QUERY_KEY, itId] as const
export const partnerITMenuOptionsKey = (itId: string) =>
  [...PARTNER_IT_QUERY_KEY, itId, 'menu-options'] as const
export const partnerITBookingsKey = (itId: string) =>
  [...PARTNER_IT_QUERY_KEY, itId, 'bookings'] as const
export const partnerITInviteesKey = (itId: string) =>
  [...PARTNER_IT_QUERY_KEY, itId, 'invitees'] as const
export const PARTNER_BOOKING_QUERY_KEY = ['partner', 'bookings'] as const
export const partnerBookingKey = (bookingId: string) =>
  [...PARTNER_BOOKING_QUERY_KEY, bookingId] as const
export const PARTNER_MINGLER_QUERY_KEY = ['partner', 'minglers'] as const
export const partnerMinglerKey = (minglerId: string) =>
  [...PARTNER_MINGLER_QUERY_KEY, minglerId] as const

/**
 * J6F-specific error codes (spec §4.3), as the backend actually ships them.
 *
 * `PROMINGLER_BOOKING` carries **both** spellings on purpose: the spec documents
 * the short `ERR_PROMINGLER_BOOKING`, the backend confirmed it ships the longer
 * `…_NOT_CANCELLABLE`. Matching both means a rename in either direction cannot
 * silently regress the copy.
 *
 * `ERR_PROFILE_READ_ONLY` is reused from J6A — the backend returns it when the
 * restaurant is not ACTIVE, though the spec's endpoint-6 table omits it.
 */
export const IT_ERROR_CODES = {
  BOOKING_NOT_CANCELLABLE: 'ERR_BOOKING_NOT_CANCELLABLE',
  PROMINGLER_BOOKING: 'ERR_PROMINGLER_BOOKING_NOT_CANCELLABLE',
  PROMINGLER_BOOKING_SHORT: 'ERR_PROMINGLER_BOOKING',
  INVITE_NOT_CANCELLABLE: 'ERR_INVITE_NOT_CANCELLABLE',
} as const

/**
 * The statuses a partner can ever see (BR-03).
 *
 * `DRAFT` is deliberately absent: the server filters it out of the list and 404s
 * the detail, so there is no Draft filter chip to build.
 */
export const VISIBLE_IT_STATUSES = [
  'PENDING',
  'COMING_SOON',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
] as const

/** Booking statuses, from J10C's canonical model. */
export const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const

/** Invite statuses (BR-06). Only `INVITED` is cancellable. */
export const INVITE_STATUSES = ['INVITED', 'TABLE_BOOKED', 'CANCELLED'] as const

/** How the Promingler was designated — drives the tick vs crown (BR-10). */
export const PROMINGLER_KINDS = ['ADMIN_ASSIGNED', 'SELF_CLAIMED', 'NONE'] as const

/**
 * Page sizes the grid accepts; the first is the default.
 *
 * Deliberately the same set as `USERS_PAGE_SIZE_OPTIONS`, because J6F reuses the
 * shared `UsersPagination` control and that control's size dropdown is built from
 * the users list. Accepting a narrower set here would let a partner pick `100 / page`
 * and have it silently dropped by `sanitiseInterestTablesParams` — a control that
 * lies, which is exactly what that component's own comment warns against.
 */
export const IT_PAGE_SIZES = [10, 25, 50, 100] as const
export const IT_DEFAULT_PAGE_SIZE = 10

/** The detail page's tab keys. Unchanged from the prototype so `?tab=` deep links keep working. */
export const IT_TAB_KEYS = {
  overview: 'overview',
  bookings: 'bookings',
  /** Labelled "Menu Options"; the key stays `combos` so bookmarks survive. */
  menuOptions: 'combos',
  invited: 'invited',
} as const
