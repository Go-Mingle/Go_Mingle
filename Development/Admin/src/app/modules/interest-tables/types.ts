// A's real lifecycle statuses are UPPERCASE; DRAFT/COMING_SOON are the two new
// states from the redesign, kept in A's UPPERCASE convention.
export type InterestTableStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DRAFT'
  | 'COMING_SOON'

/** Redesign concept — table availability mode. Shell until the backend emits it. */
export type AvailabilityMode = 'available_now' | 'coming_soon'

/** Real API availability mode (UPPERCASE), used in the create/update request bodies. */
export type AvailabilityModeApi = 'AVAILABLE_NOW' | 'COMING_SOON'

/** Real API event duration in minutes (60/90/120/150/180 = 1/1.5/2/2.5/3h). */
export type DurationMinutes = 60 | 90 | 120 | 150 | 180

export interface TopicRef {
  id: string
  name: string
  graphicUrl: string | null
}

export interface AssignedTableRef {
  id: string
  name: string
}

export interface RestaurantRef {
  id: string
  name: string
}

/** Redesign concept — a Pro Mingler assigned to host a table. Shell until backend. */
export interface ProminglerRef {
  id: string
  name?: string
  /** Real list API returns the Pro Mingler under `fullName`. */
  fullName?: string
  email?: string
}

/** Redesign concept — an interest-table media item. Shell until backend. */
export interface InterestTableMedia {
  url: string
  type: 'image' | 'video'
  caption?: string
}

export interface ChangeProminglerDto {
  prominglerMinglerId: string
}

export interface InterestTable {
  id: string
  name: string
  topic: TopicRef | null
  assignedTable: AssignedTableRef | null
  restaurant: RestaurantRef
  // ── Legacy V7 seat/duration fields (MET-1400) ──────────────────────────────
  // The real V8 API does NOT send these — it sends `minGuests`/`maxGuests`/
  // `durationMinutes` below, and reports occupancy through the bookings list.
  // They are optional because they are absent on every real payload; only the
  // mocks and older fixtures still carry them. NEVER read them directly —
  // go through the resolvers in `tableFields.ts`, which fall back correctly.
  /** @deprecated Legacy/mock-only. Use `countBookedSeats()` over the bookings list. */
  seatsBooked?: number
  /** @deprecated Legacy/mock-only. Use `resolveMinGuests()`. */
  minMinglers?: number
  /** @deprecated Legacy/mock-only. Use `resolveMaxGuests()`. */
  maxMinglers?: number
  startDate: string // YYYY-MM-DD
  startTime: string // HH:mm (24h)
  /** @deprecated Legacy/mock-only. Use `resolveDurationHours()`. */
  durationHours?: number
  /** Real detail API returns duration in minutes (60/90/120/150/180). */
  durationMinutes?: DurationMinutes
  sponsorName: string | null
  sponsorLogoUrl: string | null
  eventImageUrl: string | null
  timeLeft: string | null // e.g. "2d 3h", "45m", "Started", "Completed", "Cancelled"
  status: InterestTableStatus
  created: string // ISO timestamp
  // ── Redesign fields (optional shells — undefined until the backend returns them) ──
  mode?: AvailabilityMode
  /** Real list API availability mode (UPPERCASE). Rendered in the restaurant IT-tab table. */
  availabilityMode?: 'AVAILABLE_NOW' | 'COMING_SOON'
  inviteOnly?: boolean
  /** Real list API — whether a Pro Mingler is assigned to host this table. */
  prominglerEnabled?: boolean
  /** Real list API — id of the assigned Pro Mingler mingler. */
  prominglerMinglerId?: string
  inviteList?: string[]
  inviteDates?: Record<string, string>
  promingler?: ProminglerRef
  selfCaptain?: ProminglerRef
  minGuests?: number
  maxGuests?: number
  coverImage?: string
  thumbnail?: string
  media?: InterestTableMedia[]
  comboIds?: string[]
  minglerCount?: number
  description?: string
  confirmedCount?: number
  expiresAt?: string
}

// Interest-table menu options share the same course-based shape as restaurant
// menu options — see MenuOptionItem in restaurants/restaurantApi.types.ts.
export type { MenuOptionItem as InterestTableMenuOptionItem } from '../restaurants/restaurantApi.types'

export interface CreateInterestTablePayload {
  name: string
  topicId: string
  maxGuests: number // 4–8 (min platform-fixed at 4)
  startDate: string // YYYY-MM-DD
  startTime: string // HH:mm 24h
  durationMinutes: DurationMinutes // 60/90/120/150/180
  restaurantTableId: string
  menuOptionIds: string[] // 1–3 UUIDs
  availabilityMode: AvailabilityModeApi
  prominglerEnabled?: boolean
  prominglerMinglerId?: string
  inviteOnly?: boolean
  inviteList?: string[]
  coverImageKey?: string
  publish?: boolean // false → DRAFT, true → create-and-publish
}

export interface ListInterestTablesQuery {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
  q?: string
  status?: string
}

export interface InterestTableListData {
  items: InterestTable[]
  pagination: {
    page: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

export interface AvailabilityCheckResult {
  assignable: boolean
  reason: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-restaurant master list — GET /api/v1/interest-tables (CR-43).
// Deliberately separate from `InterestTable`: the master list is a purpose-built
// grid projection (pre-formatted dates, a flat promingler, a joined restaurant)
// and does not carry the detail/per-restaurant fields.
// ─────────────────────────────────────────────────────────────────────────────

/** Sortable master-list columns. `maxGuests` is sort-only (never searchable). */
export type InterestTableSortField = 'interestTable' | 'restaurant' | 'dateTime' | 'maxGuests'

/** Which column the magnifier targets. Omitted → the API searches both. */
export type InterestTableSearchField = 'interestTable' | 'restaurant'

/**
 * The API sends the Promingler's name as a bare string today, so there is no id
 * to link to. Typed as a union so the Promingler cell starts linking to the
 * mingler detail page the moment the backend upgrades it to `{ id, name }` —
 * no frontend change required. `null` renders as "Self Captain".
 */
export type MasterProminglerRef = string | { id: string; name: string }

export interface MasterInterestTableItem {
  id: string
  name: string
  /** Ready-to-use public CloudFront URL (cover override, else restaurant photo). */
  coverImageUrl: string | null
  /** null only in the pathological missing-join case. Supplies `{rid}` for row nav. */
  restaurant: RestaurantRef | null
  /** Pre-formatted "DD-MM-YYYY" — NOT ISO. Never feed to an ISO parser. */
  startDate: string
  /** Pre-formatted "HH:MM" (24h) — NOT ISO. */
  startTime: string
  maxGuests: number
  availabilityMode: AvailabilityModeApi
  inviteOnly: boolean
  promingler: MasterProminglerRef | null
  status: InterestTableStatus
}

export interface ListAllInterestTablesParams {
  page?: number
  /** 10 | 25 | 50 — the API defaults to 25 here, not the per-restaurant grid's 10. */
  pageSize?: 10 | 25 | 50
  sortBy?: InterestTableSortField
  sortOrder?: 'asc' | 'desc'
  /** ≤ 100 chars — the API 400s with ERR_VALIDATION beyond that. */
  search?: string
  searchField?: InterestTableSearchField
  availabilityMode?: AvailabilityModeApi[]
  status?: InterestTableStatus[]
  restaurantId?: string[]
  inviteOnly?: boolean
}

export interface MasterInterestTableListData {
  items: MasterInterestTableItem[]
  pagination: {
    page: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

/** Real PATCH /interest-tables/{id} body — all fields optional (partial update). */
export interface UpdateInterestTablePayload {
  name?: string
  topicId?: string
  maxGuests?: number
  startDate?: string
  startTime?: string
  durationMinutes?: DurationMinutes
  restaurantTableId?: string
  menuOptionIds?: string[]
  availabilityMode?: AvailabilityModeApi
  prominglerEnabled?: boolean
  prominglerMinglerId?: string
  inviteOnly?: boolean
  inviteList?: string[]
  coverImageKey?: string
}

export interface MakeAvailableResult {
  id: string
  status: string
  availability: string
}

export type InviteeStatus = 'INVITED' | 'TABLE_BOOKED'

export interface InviteeRow {
  minglerId: string
  fullName: string | null
  avatarUrl: string | null
  isPromingler: boolean
  dateInvited: string
  status: string
}

export interface ListInviteesQuery {
  page?: number
  pageSize?: 10 | 25 | 50
  sortBy?: 'mingler' | 'dateInvited' | 'status'
  sortOrder?: 'asc' | 'desc'
  status?: InviteeStatus
  q?: string
}

export interface InviteesListData {
  items: InviteeRow[]
  pagination: {
    page: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

export interface RemoveInviteeResult {
  minglerId: string
  removed: boolean
}

export interface CancelInterestTableResult {
  id: string
  status: string
  cancelledCount?: number
}

/** Active-Promingler lookup item (GET /minglers/prominglers/active). */
export interface ProminglerLookupItem {
  id: string
  fullName: string
  phone: string | null
  email: string | null
}

/** Mingler lookup item (GET /minglers) for the invite-list picker. */
export interface MinglerLookupItem {
  id: string
  fullName: string
}

// Provisional — field names may not match J10C final shape (OPEN-ISSUE-003)
export interface InterestTableBooking {
  [key: string]: unknown
  id: string
  bookingId: string
  minglerId?: string
  guest: string
  date: string
  interestTableId: string
  interestTableTopic: string
  comboId: string
  comboName: string
  status: InterestTableStatus
  bill: number
  isCaptain?: boolean
  // Redesign shells — undefined until the backend returns Pro Mingler flags.
  isPromingler?: boolean
  prominglerVerified?: boolean
}
