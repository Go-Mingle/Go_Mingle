import { http } from 'msw'
import { PARTNER_AMENITIES_ENDPOINTS } from '../../app/modules/restaurants/partnerAmenities/constants'
import { listMockAmenities, setMockAmenitySelected } from '../data/partnerAmenities'

/**
 * J6C's two client-callable endpoints.
 *
 * No search param: filtering is client-side by design (BR-08), so the GET takes
 * nothing at all.
 */
export const partnerAmenitiesHandlers = [
  http.get(PARTNER_AMENITIES_ENDPOINTS.list, () => listMockAmenities()),

  http.put(PARTNER_AMENITIES_ENDPOINTS.byId(':amenityId'), async ({ params, request }) =>
    setMockAmenitySelected(
      String(params.amenityId),
      (await request.json()) as Record<string, unknown>,
    ),
  ),
]
