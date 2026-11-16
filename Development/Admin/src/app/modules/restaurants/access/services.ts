import { httpClient } from '../../../../shared/api/httpClient'
import type {
  CreateRestaurantPayload,
  CreateRestaurantResult,
  GrantAccessPayload,
  GrantAccessResult,
  InvitedRestaurant,
  PortalLogin,
} from './types'

const BASE = '/api/v1/restaurants'

export const restaurantAccessService = {
  create: (data: CreateRestaurantPayload): Promise<CreateRestaurantResult> =>
    httpClient.post(BASE, data),

  invited: (): Promise<{ items: InvitedRestaurant[] }> => httpClient.get(`${BASE}/invited`),

  resend: (id: string): Promise<{ id: string; emailed: boolean }> =>
    httpClient.post(`${BASE}/invited/${id}/resend`, {}),

  cancel: (id: string): Promise<{ id: string; cancelled: boolean }> =>
    httpClient.delete(`${BASE}/invited/${id}`),

  logins: (restaurantId: string): Promise<{ items: PortalLogin[] }> =>
    httpClient.get(`${BASE}/${restaurantId}/logins`),

  grant: (restaurantId: string, data: GrantAccessPayload): Promise<GrantAccessResult> =>
    httpClient.post(`${BASE}/${restaurantId}/logins`, data),
}
