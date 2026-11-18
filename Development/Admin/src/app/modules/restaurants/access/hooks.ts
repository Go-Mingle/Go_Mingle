import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { restaurantAccessService } from './services'
import type { CreateRestaurantPayload, GrantAccessPayload, UpdateLoginPayload } from './types'

export const INVITED_RESTAURANTS_QUERY_KEY = ['restaurants', 'invited'] as const
export const portalLoginsQueryKey = (restaurantId: string) =>
  ['restaurant', restaurantId, 'logins'] as const

export function useInvitedRestaurantsQuery() {
  return useQuery({
    queryKey: INVITED_RESTAURANTS_QUERY_KEY,
    queryFn: () => restaurantAccessService.invited(),
    select: (data) => data.items,
  })
}

function useRefreshInvited() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: INVITED_RESTAURANTS_QUERY_KEY })
}

export function useCreateRestaurantMutation() {
  const refresh = useRefreshInvited()
  return useMutation({
    mutationFn: (data: CreateRestaurantPayload) => restaurantAccessService.create(data),
    onSuccess: refresh,
  })
}

export function useResendInviteMutation() {
  return useMutation({ mutationFn: (id: string) => restaurantAccessService.resend(id) })
}

export function useCancelInviteMutation() {
  const refresh = useRefreshInvited()
  return useMutation({
    mutationFn: (id: string) => restaurantAccessService.cancel(id),
    onSuccess: refresh,
  })
}

export function usePortalLoginsQuery(restaurantId: string | undefined) {
  return useQuery({
    queryKey: portalLoginsQueryKey(restaurantId ?? ''),
    queryFn: () => restaurantAccessService.logins(restaurantId!),
    enabled: Boolean(restaurantId),
    select: (data) => data.items,
  })
}

export function useGrantAccessMutation(restaurantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: GrantAccessPayload) => restaurantAccessService.grant(restaurantId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: portalLoginsQueryKey(restaurantId) }),
  })
}

export function useUpdateLoginMutation(restaurantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ loginId, data }: { loginId: string; data: UpdateLoginPayload }) =>
      restaurantAccessService.updateLogin(restaurantId, loginId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: portalLoginsQueryKey(restaurantId) }),
  })
}

export function useRemoveLoginMutation(restaurantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (loginId: string) => restaurantAccessService.removeLogin(restaurantId, loginId),
    onSuccess: () => qc.invalidateQueries({ queryKey: portalLoginsQueryKey(restaurantId) }),
  })
}
