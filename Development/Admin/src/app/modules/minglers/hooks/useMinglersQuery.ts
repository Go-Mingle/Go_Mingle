import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import { minglersService, adminBookingsService } from '../services'
import type { ListMinglersQueryParams, AdminBookingsQueryParams } from '../types'

export function useMinglersQuery(params: ListMinglersQueryParams = {}) {
  return useQuery({
    queryKey: ['minglers', params],
    queryFn: () => minglersService.getAll(params),
    placeholderData: keepPreviousData,
  })
}

/**
 * Paginated directory feed for scroll-loaded pickers (e.g. the interest-table
 * invite-only select). Pages accumulate; `getNextPageParam` returns the next
 * page number until the last page is reached. Search is server-side — the
 * caller decides when to pass `search` (e.g. only at ≥3 chars).
 */
export function useInfiniteMinglersQuery(
  params: {
    name?: string
    phone?: string
    email?: string
    pageSize?: 10 | 25 | 50
  } = {},
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: ['minglers', 'infinite', params],
    queryFn: ({ pageParam }) => minglersService.getAll({ ...params, page: pageParam }),
    initialPageParam: 1,
    // Defensive: a partial/legacy response without `pagination` must not crash
    // the picker — treat it as a single terminal page.
    getNextPageParam: (last) =>
      last?.pagination && last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useMinglerDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['mingler', id],
    queryFn: () => minglersService.getById(id!),
    enabled: !!id,
  })
}

function invalidateMingler(qc: ReturnType<typeof useQueryClient>, id: string) {
  void qc.invalidateQueries({ queryKey: ['mingler', id] })
  void qc.invalidateQueries({ queryKey: ['minglers'] })
}

export function useSuspendMinglerMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      minglersService.suspend(id, reason),
    onSuccess: (_data, { id }) => invalidateMingler(qc, id),
  })
}

export function useReactivateMinglerMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => minglersService.reactivate(id),
    onSuccess: (_data, { id }) => invalidateMingler(qc, id),
  })
}

export function useActiveBookingsCountQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['mingler', id, 'active-bookings-count'],
    queryFn: () => minglersService.getActiveBookingsCount(id!),
    enabled: enabled && !!id,
  })
}

export function useSetProminglerMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isPromingler }: { id: string; isPromingler: boolean }) =>
      minglersService.setPromingler(id, isPromingler),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['mingler', id] })
      // Refresh the directory list so the Pro Mingler badge updates there too.
      void qc.invalidateQueries({ queryKey: ['minglers'] })
    },
  })
}

export function useMinglerEatingPreferencesQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['mingler', id, 'eating-preferences'],
    queryFn: () => minglersService.getEatingPreferences(id!),
    enabled: enabled && !!id,
  })
}

export function useMinglerPaymentMethodsQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['mingler', id, 'payment-methods'],
    queryFn: () => minglersService.getPaymentMethods(id!),
    enabled: enabled && !!id,
  })
}

export function useSetDefaultPaymentMethodMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ minglerId, paymentMethodId }: { minglerId: string; paymentMethodId: string }) =>
      minglersService.setDefaultPaymentMethod(minglerId, paymentMethodId),
    onSuccess: (_data, { minglerId }) => {
      void qc.invalidateQueries({ queryKey: ['mingler', minglerId, 'payment-methods'] })
    },
  })
}

export function useAdminBookingsQuery(params: AdminBookingsQueryParams, enabled: boolean) {
  return useQuery({
    queryKey: ['admin-bookings', params],
    queryFn: () => adminBookingsService.getAll(params),
    enabled: enabled && !!params.minglerId,
    placeholderData: keepPreviousData,
  })
}

export function useCancelBookingMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bookingId: string) => adminBookingsService.cancel(bookingId),
    onSuccess: () => {
      // Refetch the bookings list (row → CANCELLED) and the mingler-scoped
      // queries that surface active-booking counts.
      void qc.invalidateQueries({ queryKey: ['admin-bookings'] })
      void qc.invalidateQueries({ queryKey: ['mingler'] })
    },
  })
}
