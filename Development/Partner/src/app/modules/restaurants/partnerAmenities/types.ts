/**
 * One row of the Amenities tab: a catalogue amenity plus whether this restaurant
 * has it.
 *
 * Every item is an **active** catalogue amenity. A catalogue soft-delete cascades
 * to the relationship rows, so a retired amenity is simply absent — there is no
 * shown-but-inactive state and no "removed from catalogue" label (BR-05).
 */
export interface CatalogueAmenity {
  amenityId: string
  name: string
  /** CDN URL for the icon, admin-managed. May fail to load — render a fallback. */
  iconUrl: string
  /** True when the restaurant has a live `restaurant_amenities` row for it. */
  selected: boolean
}

/**
 * The list item as it arrives.
 *
 * The id field is uncertain: spec §184 documents `amenityId`, while the backend's
 * hand-off note shows `id`. That field builds the toggle's PUT path, so both are
 * accepted and normalised once, in `services.ts`. Remove the tolerance once the
 * backend confirms which it actually sends.
 */
export interface RawCatalogueAmenity {
  amenityId?: string
  id?: string
  name?: string
  iconUrl?: string
  selected?: boolean
}

/** The PUT echoes the resulting state. */
export interface ToggleAmenityResponse {
  amenityId: string
  selected: boolean
}
