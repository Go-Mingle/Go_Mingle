import { httpClient } from '../../../shared/api/httpClient'
import type {
  UserRow,
  CreateUserDto,
  UpdateUserDto,
  ChangeUserPasswordDto,
  ListUsersQueryParams,
  UserListResponse,
} from './types'
import { USERS_ENDPOINTS } from './constants'

export type { CreateUserDto, UpdateUserDto, ChangeUserPasswordDto }

export const usersService = {
  getAll: (params: ListUsersQueryParams = {}): Promise<UserListResponse> => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.pageSize) qs.set('pageSize', String(params.pageSize))
    if (params.sortBy) qs.set('sortBy', params.sortBy)
    if (params.sortOrder) qs.set('sortOrder', params.sortOrder)
    if (params.q) qs.set('q', params.q)
    if (params.roleIds) qs.set('roleIds', params.roleIds)
    if (params.statuses) qs.set('statuses', params.statuses)
    const url = qs.toString() ? `${USERS_ENDPOINTS.list}?${qs}` : USERS_ENDPOINTS.list
    return httpClient.get<UserListResponse>(url)
  },

  getById: (id: string): Promise<UserRow> => httpClient.get<UserRow>(USERS_ENDPOINTS.byId(id)),

  create: (data: CreateUserDto): Promise<UserRow> =>
    httpClient.post<UserRow>(USERS_ENDPOINTS.list, data),

  update: (id: string, data: UpdateUserDto): Promise<UserRow> =>
    httpClient.patch<UserRow>(USERS_ENDPOINTS.byId(id), data),

  changePassword: (
    id: string,
    data: ChangeUserPasswordDto,
  ): Promise<{ id: string; email: string; passwordChangedAt: string }> =>
    httpClient.post(USERS_ENDPOINTS.changePassword(id), data),

  delete: (id: string): Promise<void> => httpClient.delete<void>(USERS_ENDPOINTS.byId(id)),
}
