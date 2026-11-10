// ── Shared list-view Application type (UI row shape) ──────────
export interface Application {
  id: string
  name: string
  cuisine: string
  owner: string
  phone: string
  email: string
  city: string
  submitted: string
  status: string
  rejectedOn?: string
  rejectionReason?: string
  [key: string]: unknown
}

// ── Detail-view media / doc types ─────────────────────────────
export interface AppDoc {
  name: string
  size: string
}

export interface AppPhoto {
  id: string
  filename: string
  url: string
}

export interface AppVideo {
  id: string
  filename: string
  size: string
  duration: string
  url: string
}

// Full detail shape (extends list Application with extra fields)
export interface ApplicationDetail extends Application {
  address: string
  tradeLicence: string
  tradeLicenceExpiry: string
  businessReg: string
  docs: AppDoc[]
  media: { photos: AppPhoto[]; videos: AppVideo[] }
}

// ── J9 Approval API contract ──────────────────────────────────
export type ApprovalStatusTab = 'pending' | 'rejected'
export type ApprovalSortBy = 'restaurant' | 'owner' | 'city' | 'submittedAt'
export type ApprovalSortOrder = 'asc' | 'desc'
export type ApprovalPageSize = 10 | 25 | 50

export interface ListApprovalsQueryParams {
  status?: ApprovalStatusTab
  page?: number
  pageSize?: ApprovalPageSize
  sortBy?: ApprovalSortBy
  sortOrder?: ApprovalSortOrder
  // Independent per-column search params — the backend supports filtering the
  // restaurant name, owner name and city columns simultaneously.
  restaurant?: string
  owner?: string
  city?: string
}

/** Raw item returned by GET /api/v1/admin/approvals (rejected tab adds the last two). */
export interface ApprovalApiItem {
  id: string
  name: string
  cuisine: string
  ownerName: string
  ownerPhone?: string
  ownerEmail?: string
  city: string
  submittedAt: string
  avatarUrl?: string
  rejectedAt?: string
  latestReason?: string
}

export interface ApprovalPagination {
  page: number
  pageSize: number
  totalRecords: number
  totalPages: number
}

export interface ApprovalApiListResponse {
  items: ApprovalApiItem[]
  pagination: ApprovalPagination
}

/** Mapped list result consumed by the UI (items normalised to the Application row shape). */
export interface ApprovalListResult {
  items: Application[]
  pagination: ApprovalPagination
}

export interface RejectionEntry {
  reason: string
  rejectedAt: string
  rejectedBy: string
}

/** GET /api/v1/admin/approvals/{id} */
export interface ApprovalDetailResponse {
  id: string
  name: string
  status: string
  visibleOnApp: boolean
  submittedAt: string
  rejections: RejectionEntry[]
}

export interface ApproveRequest {
  categoryId: string
}

export interface ApproveResponse {
  id: string
  status: string
  category: { id: string; name: string }
}

export interface DeclineRequest {
  reason: string
}

export interface DeclineResponse {
  id: string
  status: string
  rejectedAt: string
}
