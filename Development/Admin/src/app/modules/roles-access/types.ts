import type React from 'react'

export type PermissionKey =
  | 'ROLES_AND_ACCESS'
  | 'USERS'
  | 'CATEGORIES'
  | 'INTEREST_TOPICS'
  | 'LOYALTY_CONFIGURATION'
  | 'AMENITIES'
  | 'PREFERENCE_QUESTIONS'
  | 'TIMER_SETTINGS'
  | 'EMAIL_TEMPLATES'
  | 'RESTAURANT_APPROVALS'
  | 'MANAGE_RESTAURANTS'
  | 'MANAGE_MINGLERS'
  | 'BOOKINGS'
  | 'REVIEWS'
  | 'FINANCES'
  | 'CHANGE_LOG'

export interface Role {
  id: string
  name: string
  fullAccess: boolean
  permissions: string[]
  usersAssigned: number
  deleted_at?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface PaginationMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface RolesListResponse {
  items: Role[]
  pagination: PaginationMeta
}

export interface PermissionEntry {
  key: PermissionKey
  label: string
}

export interface PermissionSection {
  section: string
  permissions: PermissionEntry[]
}

export interface PermissionCatalogue {
  sections: PermissionSection[]
}

export interface CreateRoleDto {
  name: string
  fullAccess: boolean
  permissions: string[]
}

export interface RoleModule {
  key: string
  label: string
}

export interface ModuleColour {
  bg: string
  text: string
}

export interface FilterDropdownProps {
  setSelectedKeys: (keys: React.Key[]) => void
  selectedKeys: React.Key[]
  confirm: () => void
  clearFilters?: () => void
}
