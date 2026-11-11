export interface RestaurantCategoryRef {
  id: string
  name: string
}

export type RestaurantStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED'

/**
 * CR-45 — the statuses the restaurants directory will serve. `statuses[]` on
 * GET /api/v1/restaurants is an allow-list over exactly these: the API 422s
 * with ERR_VALIDATION on anything else, including PENDING/REJECTED, which used
 * to validate and come back as an empty page. Those two live in the J9 approval
 * queue instead; Partner-Portal DRAFT restaurants are never Admin-visible at
 * all. See DIRECTORY_STATUSES in ./constants for the runtime allow-list.
 */
export type RestaurantDirectoryStatus = Extract<RestaurantStatus, 'ACTIVE' | 'SUSPENDED'>

export interface Pagination {
  page: number
  pageSize: number
  totalRecords: number
  totalPages: number
}

export interface RestaurantListItem {
  id: string
  name: string
  cuisine: string | null
  city: string | null
  category: RestaurantCategoryRef | null
  confirmedBookings: number
  joinedAt: string
  status: RestaurantStatus
  visibleOnApp: boolean
  avatarUrl: string | null
}

export interface RestaurantListResponse {
  items: RestaurantListItem[]
  pagination: Pagination
}

export type RestaurantsSortBy =
  | 'name'
  | 'cuisine'
  | 'city'
  | 'category'
  | 'joinedAt'
  | 'status'
  | 'bookings'
export type RestaurantsSortOrder = 'asc' | 'desc'
export type RestaurantsSearchField = 'name'

export interface ListRestaurantsParams {
  page?: number
  pageSize?: 10 | 25 | 50
  sortBy?: RestaurantsSortBy
  sortOrder?: RestaurantsSortOrder
  q?: string
  searchField?: RestaurantsSearchField
  categoryIds?: string[]
  cities?: string
  statuses?: RestaurantDirectoryStatus[]
}

export interface RestaurantDetail {
  id: string
  name: string
  status: string
  visibleOnApp: boolean
  category: RestaurantCategoryRef | null
  cuisine: string | null
  description: string | null
  seatingCapacity: number | null
  phone: string | null
  email: string | null
  website: string | null
  fullAddress: string | null
  areaDistrict: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  ownerName: string | null
  ownerPhone: string | null
  ownerEmail: string | null
  businessRegNo: string | null
  servesAlcohol: boolean | null
  houseRules: string | null
  dressCode: string | null
  joinedAt: string
  confirmedBookings: number
  avatarUrl: string | null
  /** The partner's uploaded menu PDF, when there is one. */
  menuPdfUrl?: string | null
}

/**
 * CR-56 — a partner-written contact on the restaurant's Contacts tab. Admin is
 * read-only here: rows are created and maintained in the Partner Portal (J6A),
 * so there is no create/update/delete counterpart to this type.
 */
export interface RestaurantContact {
  id: string
  /** The only guaranteed field — a contact may legitimately be just a name. */
  name: string
  title: string | null
  email: string | null
  phone: string | null
}

export interface RestaurantContactsResponse {
  items: RestaurantContact[]
}

export interface TableAvailabilityWindow {
  dayOfWeek: number
  start: string
  end: string
}

export interface RestaurantTable {
  id: string
  name: string
  availability: TableAvailabilityWindow[]
}

export interface RestaurantTablesResponse {
  items: RestaurantTable[]
}

export interface RestaurantAmenity {
  id: string
  name: string
  /** CDN URL to the uploaded SVG; null means render the built-in default icon. */
  iconUrl: string | null
}

export interface RestaurantAmenitiesResponse {
  items: RestaurantAmenity[]
}

export interface MenuOptionCourse {
  /** Course name, e.g. "Main Course". */
  course: string
  /** How many options the diner picks from this course. */
  choose: number
  options: string[]
}

export interface MenuOptionItem {
  id: string
  name: string
  pricePkr: number | null
  courses: MenuOptionCourse[]
}

export interface MenuOptionsResponse {
  items: MenuOptionItem[]
}

export interface ChangeCategoryPayload {
  categoryId: string
}

export interface ChangeCategoryResult {
  id: string
  category: RestaurantCategoryRef | null
}

export interface ActiveCategory {
  id: string
  name: string
  commissionRate?: number
  interestTablesPerMonth?: number
}

// ── Media (Documents / Photos & Videos tabs) ────────────────────────────────
export type RestaurantMediaKind = 'DOCUMENT' | 'PHOTO' | 'VIDEO'

export interface RestaurantMediaItem {
  kind: RestaurantMediaKind
  name: string
  contentType: string
  sortOrder: number
  url: string | null
}

export interface RestaurantMediaResponse {
  items: RestaurantMediaItem[]
}

// ── Suspend / Unsuspend ─────────────────────────────────────────────────────
export interface SuspendPayload {
  reason: string
}

export interface SuspendResult {
  id: string
  status: string
  bookingsCancelled: number
}

export interface UnsuspendResult {
  id: string
  status: string
}

export interface ActiveBookingsCount {
  count: number
}

// ── Reviews ─────────────────────────────────────────────────────────────────
export type ReviewRating = 1 | 2 | 3 | 4 | 5
export type ReviewsSortBy = 'date' | 'rating' | 'interestTableName'

export interface ListReviewsParams {
  q?: string
  ratingFilter?: ReviewRating[]
  interestTableId?: string
  page?: number
  pageSize?: 10 | 25 | 50
  sortBy?: ReviewsSortBy
  sortOrder?: 'asc' | 'desc'
}

export interface ReviewSummary {
  average: number
  total: number
  distribution: Record<string, number>
  positive: number
  neutral: number
  negative: number
}

export interface ReviewRow {
  id: string
  date: string
  minglerId: string
  minglerName: string
  rating: number
  bodyPreview: string | null
  photoUrls: string[]
  bookingId: string
  interestTableId: string
  interestTableName: string
  restaurantId: string
  menuOption: string | null
}

export interface RestaurantReviewsResponse {
  summary: ReviewSummary
  items: ReviewRow[]
  pagination: Pagination
}

export interface ReviewQuestionAnswer {
  key: string
  label: string
  answer: number
}

export interface ReviewDetail {
  id: string
  restaurantName: string
  minglerName: string
  rating: number
  body: string | null
  photoUrls: string[]
  date: string
  bookingId: string
  interestTableId: string
  interestTableName: string
  restaurantId: string
  menuOption: string | null
  questionAnswers: ReviewQuestionAnswer[]
}

export interface InterestTableLookupItem {
  interestTableId: string
  interestTableName: string
}

export interface InterestTableLookupResponse {
  items: InterestTableLookupItem[]
}

// ── Booking detail (View Booking popup) ─────────────────────────────────────
export interface BookingDetail {
  id: string
  bookingRef: string
  interestTableName: string
  topic: string | null
  restaurantName: string
  date: string
  time: string
  menuOption: string | null
  isCrownProMingler: boolean
  isTickProMingler: boolean
  prominglerLabel: string | null
  status: string
  billPkr: number | null
}

// ── Bookings list (J10C read view, e.g. scoped by interestTableId) ──────────
export interface BookingRow {
  id: string
  bookingRef: string
  minglerId: string
  minglerName: string
  isCrownProMingler: boolean
  isTickProMingler: boolean
  prominglerLabel: string | null
  interestTableId: string
  interestTableName: string
  topic: string | null
  restaurantId: string
  restaurantName: string
  menuOption: string | null
  date: string
  time: string
  status: string
  billPkr: number | null
  /** Seats this booking holds. Absent on older payloads, where it means one. */
  seats?: number
}

export interface BookingsListResponse {
  items: BookingRow[]
  pagination: Pagination
}

export interface ListBookingsParams {
  interestTableId?: string
  restaurantId?: string
  minglerId?: string
  status?: string[]
  page?: number
  pageSize?: number
  sortBy?: 'date' | 'status' | 'mingler' | 'restaurant'
  sortOrder?: 'asc' | 'desc'
}
