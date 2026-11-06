import { httpClient } from '../../../shared/api/httpClient'
import type {
  ListRestaurantsParams,
  RestaurantListResponse,
  RestaurantDetail,
  RestaurantContactsResponse,
  RestaurantTablesResponse,
  RestaurantAmenitiesResponse,
  MenuOptionsResponse,
  ChangeCategoryPayload,
  ChangeCategoryResult,
  ActiveCategory,
  RestaurantMediaKind,
  RestaurantMediaResponse,
  SuspendPayload,
  SuspendResult,
  UnsuspendResult,
  ActiveBookingsCount,
  ListReviewsParams,
  RestaurantReviewsResponse,
  ReviewDetail,
  InterestTableLookupResponse,
  BookingDetail,
  BookingsListResponse,
  ListBookingsParams,
} from './restaurantApi.types'
import { RESTAURANTS_ENDPOINTS } from './constants'

export const restaurantsService = {
  listRestaurants: (params: ListRestaurantsParams = {}): Promise<RestaurantListResponse> => {
    const query = new URLSearchParams()
    if (params.page !== undefined) query.set('page', String(params.page))
    if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize))
    if (params.sortBy) query.set('sortBy', params.sortBy)
    if (params.sortOrder) query.set('sortOrder', params.sortOrder)
    if (params.q) query.set('q', params.q)
    if (params.searchField) query.set('searchField', params.searchField)
    params.categoryIds?.forEach((id) => query.append('categoryIds', id))
    if (params.cities) query.set('cities', params.cities)
    params.statuses?.forEach((s) => query.append('statuses', s))
    const qs = query.toString()
    return httpClient.get<RestaurantListResponse>(
      `${RESTAURANTS_ENDPOINTS.list}${qs ? `?${qs}` : ''}`,
    )
  },

  getRestaurantDetail: (id: string): Promise<RestaurantDetail> =>
    httpClient.get<RestaurantDetail>(RESTAURANTS_ENDPOINTS.byId(id)),

  getContacts: (id: string): Promise<RestaurantContactsResponse> =>
    httpClient.get<RestaurantContactsResponse>(RESTAURANTS_ENDPOINTS.contacts(id)),

  getRestaurantTables: (id: string): Promise<RestaurantTablesResponse> =>
    httpClient.get<RestaurantTablesResponse>(RESTAURANTS_ENDPOINTS.tables(id)),

  getMenuOptions: (id: string): Promise<MenuOptionsResponse> =>
    httpClient.get<MenuOptionsResponse>(RESTAURANTS_ENDPOINTS.menuOptions(id)),

  getAmenities: (id: string): Promise<RestaurantAmenitiesResponse> =>
    httpClient.get<RestaurantAmenitiesResponse>(RESTAURANTS_ENDPOINTS.amenities(id)),

  changeCategory: (id: string, payload: ChangeCategoryPayload): Promise<ChangeCategoryResult> =>
    httpClient.patch<ChangeCategoryResult>(RESTAURANTS_ENDPOINTS.changeCategory(id), payload),

  getActiveCategories: async (): Promise<ActiveCategory[]> => {
    const res = await httpClient.get<{ items: ActiveCategory[] }>(
      RESTAURANTS_ENDPOINTS.activeCategories,
    )
    return res.items
  },

  getMedia: (id: string, kind: RestaurantMediaKind): Promise<RestaurantMediaResponse> => {
    const qs = new URLSearchParams({ kind })
    return httpClient.get<RestaurantMediaResponse>(
      `${RESTAURANTS_ENDPOINTS.media(id)}?${qs.toString()}`,
    )
  },

  getActiveBookingsCount: (id: string): Promise<ActiveBookingsCount> =>
    httpClient.get<ActiveBookingsCount>(RESTAURANTS_ENDPOINTS.activeBookingsCount(id)),

  suspend: (id: string, payload: SuspendPayload): Promise<SuspendResult> =>
    httpClient.post<SuspendResult>(RESTAURANTS_ENDPOINTS.suspend(id), payload),

  unsuspend: (id: string): Promise<UnsuspendResult> =>
    httpClient.post<UnsuspendResult>(RESTAURANTS_ENDPOINTS.unsuspend(id), {}),

  listReviews: (
    rid: string,
    params: ListReviewsParams = {},
  ): Promise<RestaurantReviewsResponse> => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    params.ratingFilter?.forEach((r) => qs.append('ratingFilter', String(r)))
    if (params.interestTableId) qs.set('interestTableId', params.interestTableId)
    if (params.page !== undefined) qs.set('page', String(params.page))
    if (params.pageSize !== undefined) qs.set('pageSize', String(params.pageSize))
    if (params.sortBy) qs.set('sortBy', params.sortBy)
    if (params.sortOrder) qs.set('sortOrder', params.sortOrder)
    const str = qs.toString()
    const suffix = str ? `?${str}` : ''
    return httpClient.get<RestaurantReviewsResponse>(
      `${RESTAURANTS_ENDPOINTS.reviews(rid)}${suffix}`,
    )
  },

  getReviewDetail: (id: string): Promise<ReviewDetail> =>
    httpClient.get<ReviewDetail>(RESTAURANTS_ENDPOINTS.reviewById(id)),

  deleteReview: (id: string): Promise<void> =>
    httpClient.delete<void>(RESTAURANTS_ENDPOINTS.reviewById(id)),

  getInterestTableLookup: (rid: string): Promise<InterestTableLookupResponse> =>
    httpClient.get<InterestTableLookupResponse>(RESTAURANTS_ENDPOINTS.interestTableLookup(rid)),

  getBookingDetail: (id: string): Promise<BookingDetail> =>
    httpClient.get<BookingDetail>(RESTAURANTS_ENDPOINTS.adminBookingById(id)),

  listBookings: (params: ListBookingsParams = {}): Promise<BookingsListResponse> => {
    const qs = new URLSearchParams()
    if (params.interestTableId) qs.set('interestTableId', params.interestTableId)
    if (params.restaurantId) qs.set('restaurantId', params.restaurantId)
    if (params.minglerId) qs.set('minglerId', params.minglerId)
    if (params.status?.length) qs.set('status', params.status.join(','))
    if (params.page !== undefined) qs.set('page', String(params.page))
    if (params.pageSize !== undefined) qs.set('pageSize', String(params.pageSize))
    if (params.sortBy) qs.set('sortBy', params.sortBy)
    if (params.sortOrder) qs.set('sortOrder', params.sortOrder)
    const str = qs.toString()
    return httpClient.get<BookingsListResponse>(
      `${RESTAURANTS_ENDPOINTS.adminBookings}${str ? `?${str}` : ''}`,
    )
  },
}
