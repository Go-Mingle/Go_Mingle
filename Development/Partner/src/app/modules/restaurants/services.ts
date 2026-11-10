import { httpClient } from '../../../shared/api/httpClient'
import type { Restaurant } from './components/restaurantsPage.types'

export type RestaurantDetail = Record<string, unknown>

export const restaurantsService = {
  /** Fetch the list of restaurants (summary view). */
  getAll: (): Promise<Restaurant[]> => httpClient.get<Restaurant[]>('/api/restaurants'),

  /** Fetch full detail for a single restaurant by ID. */
  getById: (id: string): Promise<RestaurantDetail> =>
    httpClient.get<RestaurantDetail>(`/api/restaurants/${id}`),

  /** Update editable fields on a restaurant. Returns the updated record. */
  update: (id: string, patch: Record<string, unknown>): Promise<RestaurantDetail> =>
    httpClient.put<RestaurantDetail>(`/api/restaurants/${id}`, patch),
}
