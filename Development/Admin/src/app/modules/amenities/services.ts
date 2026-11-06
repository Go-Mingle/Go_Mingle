import { httpClient } from '../../../shared/api/httpClient'
import type { Amenity, ActiveAmenity, AmenitiesListResponse, ListAmenitiesParams } from './types'
import { AMENITIES_ENDPOINTS } from './constants'

export const amenitiesService = {
  getAll: (params?: ListAmenitiesParams): Promise<AmenitiesListResponse> => {
    const sp = new URLSearchParams()
    if (params?.page !== undefined) sp.set('page', String(params.page))
    if (params?.pageSize !== undefined) sp.set('pageSize', String(params.pageSize))
    if (params?.sortBy !== undefined) sp.set('sortBy', params.sortBy)
    if (params?.sortOrder !== undefined) sp.set('sortOrder', params.sortOrder)
    if (params?.q) sp.set('q', params.q)
    const qs = sp.toString()
    return httpClient.get<AmenitiesListResponse>(
      qs ? `${AMENITIES_ENDPOINTS.list}?${qs}` : AMENITIES_ENDPOINTS.list,
    )
  },

  getActive: (): Promise<{ items: ActiveAmenity[] }> =>
    httpClient.get<{ items: ActiveAmenity[] }>(AMENITIES_ENDPOINTS.active),

  getById: (id: string): Promise<Amenity> => httpClient.get<Amenity>(AMENITIES_ENDPOINTS.byId(id)),

  create: (formData: FormData): Promise<Amenity> =>
    httpClient.post<Amenity>(AMENITIES_ENDPOINTS.list, formData),

  update: (id: string, formData: FormData): Promise<Amenity> =>
    httpClient.patch<Amenity>(AMENITIES_ENDPOINTS.byId(id), formData),

  delete: (id: string): Promise<void> => httpClient.delete<void>(AMENITIES_ENDPOINTS.byId(id)),
}
