import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { restaurantsService } from '../services'
import type {
  ChangeCategoryPayload,
  ListRestaurantsParams,
  ListReviewsParams,
  ListBookingsParams,
  RestaurantMediaKind,
} from '../restaurantApi.types'

/**
 * Restaurant profiles, visibility, tables, menus and media are owned by the
 * partner and change in the Partner Portal, outside this app. These queries
 * are always treated as stale, so opening or returning to a screen shows the
 * partner's latest data instead of a cached copy.
 */
const PARTNER_OWNED = { staleTime: 0 } as const

/**
 * `options.enabled` lets a caller hold the request back until it has something
 * worth querying — e.g. a search-driven picker that must not list every
 * restaurant before the user types. Defaults to true, so existing callers are
 * unaffected.
 */
export function useRestaurantsQuery(
  params: ListRestaurantsParams = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['restaurants', params],
    ...PARTNER_OWNED,
    queryFn: () => restaurantsService.listRestaurants(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
  })
}

export function useRestaurantDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['restaurant', id],
    ...PARTNER_OWNED,
    queryFn: () => restaurantsService.getRestaurantDetail(id!),
    enabled: !!id,
  })
}

export function useRestaurantContactsQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['restaurant', id, 'contacts'],
    ...PARTNER_OWNED,
    queryFn: () => restaurantsService.getContacts(id!),
    enabled: !!id,
  })
}

export function useRestaurantTablesQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['restaurant', id, 'tables'],
    ...PARTNER_OWNED,
    queryFn: () => restaurantsService.getRestaurantTables(id!),
    enabled: !!id,
  })
}

export function useMenuOptionsQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['restaurant', id, 'menu-options'],
    ...PARTNER_OWNED,
    queryFn: () => restaurantsService.getMenuOptions(id!),
    enabled: !!id,
  })
}

export function useRestaurantAmenitiesQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['restaurant', id, 'amenities'],
    ...PARTNER_OWNED,
    queryFn: () => restaurantsService.getAmenities(id!),
    enabled: !!id,
  })
}

export function useActiveCategoriesQuery() {
  return useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => restaurantsService.getActiveCategories(),
  })
}

export function useChangeCategoryMutation(restaurantId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ChangeCategoryPayload) =>
      restaurantsService.changeCategory(restaurantId!, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['restaurant', restaurantId] })
      void qc.invalidateQueries({ queryKey: ['restaurants'] })
    },
  })
}

export function useRestaurantMediaQuery(id: string | undefined, kind: RestaurantMediaKind) {
  return useQuery({
    queryKey: ['restaurant', id, 'media', kind],
    ...PARTNER_OWNED,
    queryFn: () => restaurantsService.getMedia(id!, kind),
    enabled: !!id,
  })
}

export function useActiveBookingsCountQuery(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['restaurant', id, 'active-bookings-count'],
    queryFn: () => restaurantsService.getActiveBookingsCount(id!),
    enabled: !!id && enabled,
  })
}

export function useSuspendRestaurantMutation(restaurantId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => restaurantsService.suspend(restaurantId!, { reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['restaurant', restaurantId] })
      void qc.invalidateQueries({ queryKey: ['restaurants'] })
    },
  })
}

export function useUnsuspendRestaurantMutation(restaurantId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => restaurantsService.unsuspend(restaurantId!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['restaurant', restaurantId] })
      void qc.invalidateQueries({ queryKey: ['restaurants'] })
    },
  })
}

export function useRestaurantReviewsQuery(rid: string | undefined, params: ListReviewsParams = {}) {
  return useQuery({
    queryKey: ['restaurant', rid, 'reviews', params],
    queryFn: () => restaurantsService.listReviews(rid!, params),
    enabled: !!rid,
    placeholderData: keepPreviousData,
  })
}

export function useReviewDetailQuery(reviewId: string | undefined) {
  return useQuery({
    queryKey: ['review', reviewId],
    queryFn: () => restaurantsService.getReviewDetail(reviewId!),
    enabled: !!reviewId,
  })
}

export function useDeleteReviewMutation(restaurantId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reviewId: string) => restaurantsService.deleteReview(reviewId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['restaurant', restaurantId, 'reviews'] })
    },
  })
}

export function useBookingDetailQuery(bookingId: string | undefined) {
  return useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => restaurantsService.getBookingDetail(bookingId!),
    enabled: !!bookingId,
  })
}

export function useInterestTableBookingsQuery(
  interestTableId: string | undefined,
  params: Omit<ListBookingsParams, 'interestTableId'> = {},
) {
  return useQuery({
    queryKey: ['bookings', { interestTableId, ...params }],
    queryFn: () => restaurantsService.listBookings({ interestTableId, ...params }),
    enabled: !!interestTableId,
    placeholderData: keepPreviousData,
  })
}
