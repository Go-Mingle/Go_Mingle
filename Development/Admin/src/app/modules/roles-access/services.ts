import { httpClient } from '../../../shared/api/httpClient'
import type { Role, CreateRoleDto, RolesListResponse, PermissionCatalogue } from './types'
import { ROLES_ENDPOINTS } from './constants'

export type { CreateRoleDto }

export interface ActiveRole {
  id: string
  name: string
}

export interface RolesQueryParams {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: 'name' | 'usersAssigned'
  sortDir?: 'asc' | 'desc'
}

export const rolesService = {
  getAll: (params?: RolesQueryParams): Promise<RolesListResponse> => {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.pageSize) query.set('pageSize', String(params.pageSize))
    if (params?.search) query.set('search', params.search)
    if (params?.sortBy) query.set('sortBy', params.sortBy)
    if (params?.sortDir) query.set('sortDir', params.sortDir)
    const qs = query.toString()
    return httpClient.get<RolesListResponse>(`${ROLES_ENDPOINTS.list}${qs ? `?${qs}` : ''}`)
  },

  /** Fetch a single role by id (incl. permissions[] + fullAccess). */
  getById: (id: string): Promise<Role> => httpClient.get<Role>(ROLES_ENDPOINTS.byId(id)),

  getActive: (): Promise<{ items: ActiveRole[] }> =>
    httpClient.get<{ items: ActiveRole[] }>(ROLES_ENDPOINTS.active),

  getPermissionKeys: (): Promise<PermissionCatalogue> =>
    httpClient.get<PermissionCatalogue>(ROLES_ENDPOINTS.permissionKeys),

  create: (data: CreateRoleDto): Promise<Role> => httpClient.post<Role>(ROLES_ENDPOINTS.list, data),

  update: (id: string, data: Partial<CreateRoleDto>): Promise<Role> =>
    httpClient.patch<Role>(ROLES_ENDPOINTS.byId(id), data),

  delete: (id: string): Promise<void> => httpClient.delete<void>(ROLES_ENDPOINTS.byId(id)),
}
