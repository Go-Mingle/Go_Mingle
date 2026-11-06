import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { partnerRetryPolicy } from '../../../../shared/api/retryPolicy'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { PARTNER_USERS_QUERY_KEY } from '../constants'
import { partnerUsersService } from '../services'
import type {
  CreatePartnerUserDto,
  PartnerUsersPage,
  PartnerUsersQueryParams,
  SetPartnerUserPasswordDto,
  UpdatePartnerUserDto,
} from '../types'

/**
 * J3's server state. Mutations own cache invalidation only — toasts, modal
 * closing and form resets stay with the caller's `mutate` callbacks, matching
 * the convention across the app.
 */

/**
 * The grid. Params are part of the key so paging, sorting, searching and
 * filtering each produce their own cache entry rather than clobbering one.
 */
export function usePartnerUsersQuery(params: PartnerUsersQueryParams) {
  return useQuery<PartnerUsersPage>({
    queryKey: [...PARTNER_USERS_QUERY_KEY, params],
    queryFn: () => partnerUsersService.list(params),
    enabled: tokenStore.hasSession(),
    // Keeps the previous page visible while the next one loads, so paging and
    // filtering do not blank the table out on every keystroke.
    placeholderData: (previous) => previous,
    ...partnerRetryPolicy,
  })
}

/** Invalidates every cached page, since a write can move rows between them. */
function useInvalidateUsers() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: PARTNER_USERS_QUERY_KEY })
  }
}

export function useCreatePartnerUserMutation() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (data: CreatePartnerUserDto) => partnerUsersService.create(data),
    onSuccess: invalidate,
  })
}

export function useUpdatePartnerUserMutation() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePartnerUserDto }) =>
      partnerUsersService.update(id, data),
    onSuccess: invalidate,
  })
}

/**
 * Sets another user's password. Nothing to invalidate — no grid field changes —
 * but it stays a mutation so the caller gets `isPending` and `onError`.
 */
export function useSetPartnerUserPasswordMutation() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SetPartnerUserPasswordDto }) =>
      partnerUsersService.setPassword(id, data),
  })
}

export function useDeletePartnerUserMutation() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (id: string) => partnerUsersService.remove(id),
    onSuccess: invalidate,
  })
}
