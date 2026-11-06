/**
 * There are no roles for partner users (BR-01 / F1 BR-08) — every authenticated
 * user has identical access. `designation` is a free-text label with no access
 * meaning, so nothing here gates on it.
 */
export type PartnerUserStatus = 'ACTIVE' | 'SUSPENDED'

/**
 * A row of `GET /api/v1/partner/users`.
 *
 * The caller's own row is never present (BR-02) — self-management lives in J2's
 * My Profile / Change Password — so there is no "is this me?" case to handle.
 *
 * `email` is absent from grid rows by design: the grid is readable by everyone
 * in the restaurant. It arrives on the create and update responses instead.
 */
export interface PartnerUserListItem {
  id: string
  fullName: string
  designation: string | null
  /** Date-only (`YYYY-MM-DD`) or null when the user has never logged in (BR-13). */
  lastActiveAt: string | null
  status: PartnerUserStatus
  isPrimary: boolean
  /** UI hints for the primary-user guard (BR-03). The server enforces it regardless. */
  canSuspend: boolean
  canDelete: boolean
  email?: string
}

export interface PartnerUsersPagination {
  page: number
  pageSize: number
  totalRecords: number
  totalPages: number
}

export interface PartnerUsersPage {
  items: PartnerUserListItem[]
  pagination: PartnerUsersPagination
}

export type PartnerUsersSortBy = 'name' | 'designation' | 'lastActive' | 'status'
export type PartnerUsersSortOrder = 'asc' | 'desc'
export type PartnerUsersSearchField = 'name' | 'designation'

/**
 * Query parameters for the grid. Invalid sort/page/search/status values fall
 * back to the default grid server-side rather than 400ing, so no defensive
 * clamping is needed here. The date bounds are the exception — they do 400 —
 * and are validated by the picker before they are sent.
 */
export interface PartnerUsersQueryParams {
  page?: number
  pageSize?: number
  sortBy?: PartnerUsersSortBy
  sortOrder?: PartnerUsersSortOrder
  search?: string
  /** Omitted searches both name and designation, which a single search box implies. */
  searchField?: PartnerUsersSearchField
  status?: PartnerUserStatus[]
  lastActiveFrom?: string
  lastActiveTo?: string
}

export interface CreatePartnerUserDto {
  fullName: string
  email: string
  designation?: string
  status?: PartnerUserStatus
  password: string
  /**
   * Required and validated server-side — the opposite of J1's `signup/complete`,
   * which rejects the key outright. Here the actor is setting someone else's
   * password, so the mismatch check is a real invariant rather than UI sugar.
   */
  confirmPassword: string
}

/** The create response, which unlike a grid row does carry the email. */
export interface CreatePartnerUserResponse extends PartnerUserListItem {
  /** True when a soft-deleted record was revived rather than a new one inserted (BR-12). */
  reactivated?: boolean
}

/** Every field optional — send only what changed. `designation: ''` clears it. */
export interface UpdatePartnerUserDto {
  fullName?: string
  designation?: string
  status?: PartnerUserStatus
}

export interface SetPartnerUserPasswordDto {
  password: string
  confirmPassword: string
}

/**
 * The shape the table, cards and modals consume.
 *
 * Deliberately a distinct type from {@link PartnerUserListItem}: the UI was
 * built against these field names and is being preserved, so the API vocabulary
 * is translated once at the module boundary (see `adapters.ts`) instead of
 * rippling `fullName`/`lastActiveAt`/`ACTIVE` through every component.
 */
export interface UserRow {
  id: string
  name: string
  designation?: string
  /** Lowercased for the UI's existing `status === 'active'` comparisons. */
  status: 'active' | 'suspended'
  lastActive?: string
  initials: string
  isPrimary: boolean
  canSuspend: boolean
  canDelete: boolean
  email?: string
}
