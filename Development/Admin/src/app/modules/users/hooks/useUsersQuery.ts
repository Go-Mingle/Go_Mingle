import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { usersService } from '../services'
import type {
  CreateUserDto,
  UpdateUserDto,
  ChangeUserPasswordDto,
  ListUsersQueryParams,
} from '../types'

export function useUsersQuery(params: ListUsersQueryParams = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => usersService.getAll(params),
    placeholderData: keepPreviousData,
  })
}

export function useUserByIdQuery(id: string | null) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => usersService.getById(id!),
    enabled: id !== null,
  })
}

export function useCreateUserMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateUserDto) => usersService.create(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      // A user's role feeds each role's "users assigned" count.
      void qc.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}

export function useUpdateUserMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserDto }) =>
      usersService.update(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      // A user's role feeds each role's "users assigned" count.
      void qc.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}

export function useDeleteUserMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => usersService.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      // A user's role feeds each role's "users assigned" count.
      void qc.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}

export function useSetUserPasswordMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ChangeUserPasswordDto }) =>
      usersService.changePassword(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      // A user's role feeds each role's "users assigned" count.
      void qc.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}
