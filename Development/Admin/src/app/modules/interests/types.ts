export interface Interest {
  id: string
  name: string
  groupName: string
  createdAt?: string
  updatedAt?: string | null
}

/** Item shape returned by GET /api/v1/interests/active. */
export interface ActiveInterest {
  id: string
  name: string
  groupName: string
}

/** Pagination meta returned by GET /api/v1/interests. */
export interface InterestsPaginationMeta {
  page: number
  pageSize: number
  totalRecords: number
  totalPages: number
}

/**
 * Query parameters accepted by GET /api/v1/interests. The API silently defaults
 * every invalid value rather than rejecting it, so `sortBy` is `name | group`
 * (default `name`) and `pageSize` must be one of INTERESTS_PAGE_SIZE_OPTIONS.
 */
export interface InterestsListParams {
  page?: number
  pageSize?: number
  q?: string
  sortBy?: 'name' | 'group'
  sortOrder?: 'asc' | 'desc'
}

export interface InterestsListResponse {
  items: Interest[]
  pagination: InterestsPaginationMeta
}

export interface CreateInterestDto {
  name: string
  groupName: string
}

export type UpdateInterestDto = CreateInterestDto
