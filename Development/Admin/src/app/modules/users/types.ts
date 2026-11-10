export interface UserRow {
  id: string
  fullName: string
  email: string
  /**
   * A-02 (pentest) — a role can be soft-deleted while still assigned, in which
   * case the API returns the row with an empty `name`. Modelled as nullable so
   * every render site is forced to handle it instead of printing a blank cell.
   */
  role: { id: string; name: string | null; fullAccess: boolean }
  status: 'ACTIVE' | 'SUSPENDED'
  createdAt: string
  updatedAt?: string
}

export type UserStatus = 'ACTIVE' | 'SUSPENDED'

export interface CreateUserDto {
  fullName: string
  email: string
  roleId: string
  status?: 'ACTIVE' | 'SUSPENDED'
  password: string
  confirmPassword: string
}

export interface UpdateUserDto {
  fullName?: string
  roleId?: string
  status?: 'ACTIVE' | 'SUSPENDED'
}

export interface ChangeUserPasswordDto {
  newPassword: string
  confirmNewPassword: string
}

export interface UserListItem {
  id: string
  name: string
  email: string
  role: string
  status: UserStatus
  initials: string
  lastActive?: string
}

export interface ListUsersQueryParams {
  page?: number
  pageSize?: 10 | 25 | 50
  sortBy?: 'name' | 'role' | 'status'
  sortOrder?: 'asc' | 'desc'
  q?: string
  roleIds?: string
  statuses?: string
}

export interface UserListPagination {
  page: number
  pageSize: number
  totalRecords: number
  totalPages: number
}

export interface UserListResponse {
  items: UserRow[]
  pagination: UserListPagination
}
