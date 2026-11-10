import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { rolesService } from '../services'
import type { CreateRoleDto, RolesQueryParams } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

export function useRolesQuery(params?: RolesQueryParams) {
  return useQuery({
    queryKey: ['roles', params],
    queryFn: () => rolesService.getAll(params),
    placeholderData: keepPreviousData,
  })
}

export function usePermissionKeysQuery() {
  return useQuery({
    queryKey: ['roles', 'permissionKeys'],
    queryFn: () => rolesService.getPermissionKeys(),
    staleTime: Infinity,
  })
}

export function useCreateRoleMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateRoleDto) => rolesService.create(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}

export function useUpdateRoleMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateRoleDto> }) =>
      rolesService.update(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}

export function useDeleteRoleMutation(onBlockedByUsers?: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => rolesService.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (error: unknown) => {
      if (error instanceof HttpError && error.code === 'ERR_ROLE_HAS_ASSIGNED_USERS') {
        onBlockedByUsers?.()
      }
    },
  })
}

export function useActiveRolesQuery() {
  return useQuery({
    queryKey: ['roles', 'active'],
    queryFn: () => rolesService.getActive(),
    // Always refetch when a role picker mounts, so a role created moments ago
    // (here or by another admin) is offered straight away.
    staleTime: 0,
  })
}

export function useRoleQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['roles', 'detail', id],
    queryFn: () => rolesService.getById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}
