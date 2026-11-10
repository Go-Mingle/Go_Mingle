export interface MinglerIdentity {
  name: string
  birthdate?: string
  energyDrive?: string
  relationshipStatus?: string
  children?: string
  professionIndustry?: string
  profession?: string
  personalInterests?: string[]
  footballTeam?: string
  cricketTeam?: string
  pets?: string
  budget?: string
  enneagramType?: string
}

// ── Reviews (GET /api/v1/admin/reviews) — owned by J10D, read here ──────
/** One row in the Mingler-filtered reviews list. */
export interface MinglerReview {
  id: string
  date: string
  minglerId: string
  minglerName: string
  rating: number
  bodyPreview: string
  photoUrls: string[]
  bookingId?: string
  interestTableId?: string
  interestTableName?: string
  restaurantId?: string
  menuOption?: string
}

export interface ReviewQuestionAnswer {
  key: string
  label: string
  answer: number | string
}

/** Full review record (GET /api/v1/reviews/:id) shown in the detail modal. */
export interface ReviewDetail {
  id: string
  restaurantName: string
  minglerName: string
  rating: number
  body: string
  photoUrls: string[]
  date: string
  bookingId?: string
  interestTableId?: string
  interestTableName?: string
  restaurantId?: string
  menuOption?: string
  questionAnswers?: ReviewQuestionAnswer[]
}

export type ReviewsSortBy = 'date' | 'rating'

export interface ListReviewsQueryParams {
  minglerId: string
  q?: string
  /** Subset of {1,2,3,4,5}; serialised to the API as a CSV. */
  ratingFilter?: number[]
  page?: number
  pageSize?: 10 | 25 | 50
  sortBy?: ReviewsSortBy
  sortOrder?: MinglersSortOrder
}

export interface ReviewsPagination {
  page: number
  pageSize: number
  totalRecords: number
  totalPages: number
}

export interface MinglerReviewsResponse {
  items: MinglerReview[]
  pagination: ReviewsPagination
}

export type MinglerStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING'

// ── Minglers list (GET /api/v1/minglers) ────────────────────────
export type MinglerListStatus = 'ACTIVE' | 'SUSPENDED'

export interface MinglerListItem {
  id: string
  fullName: string
  avatarUrl: string | null
  avatarColor: string
  initials: string
  phone: string
  email: string
  joinedAt: string
  totalBookings: number
  loyaltyPoints: number
  status: MinglerListStatus
  isPromingler: boolean
}

export type MinglersSortBy =
  | 'name'
  | 'phone'
  | 'email'
  | 'joined_at'
  | 'bookings'
  | 'loyalty_points'
  | 'status'
export type MinglersSortOrder = 'asc' | 'desc'
export type MinglersSearchField = 'name' | 'phone' | 'email'

export interface ListMinglersQueryParams {
  page?: number
  pageSize?: 10 | 25 | 50
  sortBy?: MinglersSortBy
  sortOrder?: MinglersSortOrder
  name?: string
  phone?: string
  email?: string
  joinedFrom?: string
  joinedTo?: string
  statuses?: MinglerListStatus[]
}

export interface MinglerListPagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface MinglerListResponse {
  items: MinglerListItem[]
  pagination: MinglerListPagination
}

// ── Mingler detail (GET /api/v1/minglers/:id) ───────────────────
export interface MinglerAboutInfo {
  birthdate?: string
  energyDrive?: string
  relationshipStatus?: string
  children?: number
  professionIndustry?: string
  profession?: string
  /** Comma-separated list, e.g. "Football, Travel, Cooking". */
  personalInterests?: string
  footballTeam?: string
  pets?: string
  budget?: string
  enneagramType?: string
}

export interface MinglerDetail {
  id: string
  fullName: string
  avatarUrl: string | null
  avatarColor: string
  initials: string
  email: string
  phone: string
  status: MinglerListStatus
  isPromingler: boolean
  suspendedAt: string | null
  joinedAt: string
  totalBookings: number
  loyaltyPoints: number
  about?: MinglerAboutInfo
}

// ── Suspend / Reactivate / Promingler (POST/PATCH /api/v1/minglers/:id/*) ─
export interface MinglerSuspendResult {
  id: string
  status: MinglerListStatus
  suspendedAt: string
  suspendedReason: string
  bookingsCancelled: number
}

export interface MinglerReactivateResult {
  id: string
  status: MinglerListStatus
  reactivatedAt: string
}

export interface MinglerProminglerResult {
  id: string
  isPromingler: boolean
}

// ── Eating Preferences (GET /api/v1/minglers/:id/eating-preferences) ────
export type PreferenceAnswerType = 'SINGLE_SELECT' | 'MULTI_SELECT'

export interface MinglerEatingPreferenceOption {
  id: string
  text: string
}

export interface MinglerEatingPreferenceAnswer {
  questionId: string
  question: string
  type: PreferenceAnswerType
  selectedOptions: MinglerEatingPreferenceOption[]
}

export interface MinglerEatingPreferencesResponse {
  items: MinglerEatingPreferenceAnswer[]
}

// ── Payment Methods (GET/POST /api/v1/minglers/:id/payment-methods/*) ───
export type MinglerCardType = 'CREDIT' | 'DEBIT'

export interface MinglerPaymentMethod {
  paymentMethodId: string
  brand: string
  last4: string
  expiryMonth: number
  expiryYear: number
  isDefault: boolean
  cardType: MinglerCardType
}

export interface MinglerPaymentMethodsResponse {
  items: MinglerPaymentMethod[]
}

export interface SetDefaultPaymentMethodResult {
  paymentMethodId: string
  isDefault: boolean
}

// ── Bookings (GET /api/v1/admin/bookings) — owned by J10C, read-only ────
export type AdminBookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'

export interface AdminBooking {
  id: string
  bookingRef: string
  minglerId: string
  minglerName: string
  /** True when this Mingler volunteered as Table Captain for this booking's interest table. */
  isCaptain: boolean
  interestTableId: string
  interestTableName: string
  topic: string
  restaurantId: string
  restaurantName: string
  menuOption: string
  /** Pre-formatted DD-MM-YYYY, rendered as supplied. */
  date: string
  /** Pre-formatted e.g. "7:30 PM", rendered as supplied. */
  time: string
  status: AdminBookingStatus
  billPkr: number | null
}

export type AdminBookingsSortBy = 'date' | 'status' | 'mingler' | 'restaurant'

export interface AdminBookingsQueryParams {
  minglerId: string
  status?: AdminBookingStatus[]
  page?: number
  pageSize?: 10 | 25 | 50
  sortBy?: AdminBookingsSortBy
  sortOrder?: MinglersSortOrder
}

export interface AdminBookingsPagination {
  page: number
  pageSize: number
  totalRecords: number
  totalPages: number
}

export interface AdminBookingsResponse {
  items: AdminBooking[]
  pagination: AdminBookingsPagination
}
