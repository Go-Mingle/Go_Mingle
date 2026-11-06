import { httpClient } from '../../../../shared/api/httpClient'
import { PARTNER_AMENITIES_ENDPOINTS } from './constants'
import type { CatalogueAmenity, RawCatalogueAmenity, ToggleAmenityResponse } from './types'

/**
 * Normalises one list item.
 *
 * Spec §184 documents the id as `amenityId`; the backend's hand-off note shows
 * `id`. Since that value builds the toggle's PUT path, guessing wrong would break
 * every toggle on the tab — so both are accepted here, once, and everything above
 * this line sees the spec's `amenityId`.
 *
 * Remove the fallback once the backend confirms which field the API sends.
 */
export function normaliseAmenity(raw: RawCatalogueAmenity): CatalogueAmenity {
  return {
    amenityId: raw.amenityId ?? raw.id ?? '',
    name: raw.name ?? '',
    iconUrl: raw.iconUrl ?? '',
    selected: Boolean(raw.selected),
  }
}

export const partnerAmenitiesService = {
  /**
   * The whole tab in one call: the active catalogue with each item's `selected`
   * flag. There is deliberately no separate "my amenities" read, and no search
   * param — filtering is client-side (BR-08), because the catalogue is small and
   * Redis-cached.
   *
   * An item arriving without a usable id is dropped rather than rendered: it
   * could not be toggled, and a row whose switch silently does nothing is worse
   * than one that is absent.
   */
  list: async (): Promise<{ items: CatalogueAmenity[] }> => {
    const response = await httpClient.get<{ items?: RawCatalogueAmenity[] }>(
      PARTNER_AMENITIES_ENDPOINTS.list,
    )
    const items = (response.items ?? []).map(normaliseAmenity).filter((item) => item.amenityId)
    return { items }
  },

  /**
   * Save-on-toggle: one write per flip, no batching and no Save button.
   *
   * Idempotent in both directions — setting a state that already holds is a
   * successful no-op, and re-enabling a previously removed amenity reactivates
   * the old row rather than duplicating it. So a double-tap or a retry is safe.
   */
  setSelected: (amenityId: string, selected: boolean): Promise<ToggleAmenityResponse> =>
    httpClient.put<ToggleAmenityResponse>(PARTNER_AMENITIES_ENDPOINTS.byId(amenityId), {
      selected,
    }),
}
