import { httpClient } from '../../../shared/api/httpClient'
import type {
  ListMinglersQueryParams,
  MinglerListResponse,
  MinglerDetail,
  MinglerSuspendResult,
  MinglerReactivateResult,
  MinglerProminglerResult,
  MinglerEatingPreferencesResponse,
  MinglerPaymentMethodsResponse,
  SetDefaultPaymentMethodResult,
  AdminBookingsQueryParams,
  AdminBookingsResponse,
  ListReviewsQueryParams,
  MinglerReviewsResponse,
  ReviewDetail,
} from './types'
import {
  MINGLERS_ENDPOINTS,
  ADMIN_BOOKINGS_ENDPOINT,
  adminBookingCancelEndpoint,
  REVIEWS_ENDPOINTS,
} from './constants'

export type Mingler = Record<string, unknown>

export const minglersService = {
  /** Fetch a page of the mingler directory (search/sort/filter is server-side). */
  getAll: (params: ListMinglersQueryParams = {}): Promise<MinglerListResponse> => {
    const qs = new URLSearchParams()
    if (params.page !== undefined) qs.set('page', String(params.page))
    if (params.pageSize !== undefined) qs.set('pageSize', String(params.pageSize))
    if (params.sortBy) qs.set('sortBy', params.sortBy)
    if (params.sortOrder) qs.set('sortOrder', params.sortOrder)
    if (params.name) qs.set('name', params.name)
    if (params.phone) qs.set('phone', params.phone)
    if (params.email) qs.set('email', params.email)
    if (params.joinedFrom) qs.set('joinedFrom', params.joinedFrom)
    if (params.joinedTo) qs.set('joinedTo', params.joinedTo)
    params.statuses?.forEach((s) => qs.append('statuses', s))
    const query = qs.toString()
    const url = query ? `${MINGLERS_ENDPOINTS.list}?${query}` : MINGLERS_ENDPOINTS.list
    return httpClient.get<MinglerListResponse>(url)
  },
  getById: (id: string): Promise<MinglerDetail> =>
    httpClient.get<MinglerDetail>(MINGLERS_ENDPOINTS.byId(id)),

  suspend: (id: string, reason: string): Promise<MinglerSuspendResult> =>
    httpClient.post<MinglerSuspendResult>(MINGLERS_ENDPOINTS.suspend(id), { reason }),

  reactivate: (id: string): Promise<MinglerReactivateResult> =>
    httpClient.post<MinglerReactivateResult>(MINGLERS_ENDPOINTS.reactivate(id), undefined),

  getActiveBookingsCount: async (id: string): Promise<number> => {
    const res = await httpClient.get<{ count: number }>(MINGLERS_ENDPOINTS.activeBookingsCount(id))
    return res.count
  },

  setPromingler: (id: string, isPromingler: boolean): Promise<MinglerProminglerResult> =>
    httpClient.patch<MinglerProminglerResult>(MINGLERS_ENDPOINTS.promingler(id), { isPromingler }),

  getEatingPreferences: (id: string): Promise<MinglerEatingPreferencesResponse> =>
    httpClient.get<MinglerEatingPreferencesResponse>(MINGLERS_ENDPOINTS.eatingPreferences(id)),

  getPaymentMethods: (id: string): Promise<MinglerPaymentMethodsResponse> =>
    httpClient.get<MinglerPaymentMethodsResponse>(MINGLERS_ENDPOINTS.paymentMethods(id)),

  setDefaultPaymentMethod: (
    minglerId: string,
    paymentMethodId: string,
  ): Promise<SetDefaultPaymentMethodResult> =>
    httpClient.post<SetDefaultPaymentMethodResult>(
      MINGLERS_ENDPOINTS.setDefaultPaymentMethod(minglerId, paymentMethodId),
      undefined,
    ),
}

export const adminBookingsService = {
  /** Read-only bookings view owned by the Bookings module; consumed here scoped to one Mingler. */
  getAll: (params: AdminBookingsQueryParams): Promise<AdminBookingsResponse> => {
    const qs = new URLSearchParams()
    qs.set('minglerId', params.minglerId)
    if (params.status?.length) qs.set('status', params.status.join(','))
    if (params.page !== undefined) qs.set('page', String(params.page))
    if (params.pageSize !== undefined) qs.set('pageSize', String(params.pageSize))
    if (params.sortBy) qs.set('sortBy', params.sortBy)
    if (params.sortOrder) qs.set('sortOrder', params.sortOrder)
    return httpClient.get<AdminBookingsResponse>(`${ADMIN_BOOKINGS_ENDPOINT}?${qs.toString()}`)
  },

  /** Admin-cancel a single booking (no body). Server runs the refund/hold-release cascade. */
  cancel: (id: string): Promise<void> =>
    httpClient.post<void>(adminBookingCancelEndpoint(id), undefined),
}

export const reviewsService = {
  /** Mingler-filtered reviews list (search/rating filter/sort is server-side). */
  getAll: (params: ListReviewsQueryParams): Promise<MinglerReviewsResponse> => {
    const qs = new URLSearchParams()
    qs.set('minglerId', params.minglerId)
    if (params.q) qs.set('q', params.q)
    if (params.ratingFilter?.length) qs.set('ratingFilter', params.ratingFilter.join(','))
    if (params.page !== undefined) qs.set('page', String(params.page))
    if (params.pageSize !== undefined) qs.set('pageSize', String(params.pageSize))
    if (params.sortBy) qs.set('sortBy', params.sortBy)
    if (params.sortOrder) qs.set('sortOrder', params.sortOrder)
    return httpClient.get<MinglerReviewsResponse>(`${REVIEWS_ENDPOINTS.adminList}?${qs.toString()}`)
  },

  getById: (id: string): Promise<ReviewDetail> =>
    httpClient.get<ReviewDetail>(REVIEWS_ENDPOINTS.byId(id)),

  /** Soft-delete a review (204 No Content). */
  remove: (id: string): Promise<void> => httpClient.delete<void>(REVIEWS_ENDPOINTS.byId(id)),
}
