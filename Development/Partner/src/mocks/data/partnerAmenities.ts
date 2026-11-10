import { HttpResponse } from 'msw'
import { errorResponse, mockProfile } from './partnerRestaurantProfile'

/**
 * J6C amenity fixtures.
 *
 * Mirrors the real strictness rather than the happy path: the write is refused
 * while PENDING, a retired amenity 404s, a non-boolean `selected` 422s, and the
 * write is idempotent in both directions so a double-tap is a no-op success.
 *
 * `retireMockAmenity` exists because the 404 is a genuine race — an admin can
 * retire a catalogue amenity while the partner has the tab open — and that path
 * is only worth having if it can actually be exercised.
 */

const READ_ONLY_MESSAGE = "Your application is under review and can't be edited right now."

interface MockAmenity {
  amenityId: string
  name: string
  iconUrl: string
  selected: boolean
}

const CDN = 'https://cdn.gomingle.com/amenities'

function seed(): MockAmenity[] {
  // Sorted by name, as the endpoint returns them (catalogue order).
  return [
    {
      amenityId: 'a2',
      name: 'Wheelchair accessible',
      iconUrl: `${CDN}/a2.svg`,
      selected: false,
    },
    { amenityId: 'a5', name: 'Live music', iconUrl: `${CDN}/a5.svg`, selected: false },
    { amenityId: 'a3', name: 'Outdoor terrace', iconUrl: `${CDN}/a3.svg`, selected: true },
    { amenityId: 'a4', name: 'Sea view', iconUrl: `${CDN}/a4.svg`, selected: false },
    { amenityId: 'a6', name: 'Valet Parking', iconUrl: `${CDN}/a6.svg`, selected: true },
    { amenityId: 'a1', name: 'Wi-Fi free', iconUrl: `${CDN}/a1.svg`, selected: true },
  ].sort((a, b) => a.name.localeCompare(b.name))
}

let catalogue: MockAmenity[] = seed()

export function resetMockAmenities(): void {
  catalogue = seed()
}

/**
 * Removes an amenity from the active catalogue, as an admin soft-delete does.
 *
 * The cascade means it vanishes from the list *and* from the assigned set at the
 * same time (BR-05), so there is no shown-but-inactive state to model.
 */
export function retireMockAmenity(amenityId: string): void {
  catalogue = catalogue.filter((item) => item.amenityId !== amenityId)
}

/** Reads current selection state, for asserting a write actually persisted. */
export function mockAmenitySelected(amenityId: string): boolean | undefined {
  return catalogue.find((item) => item.amenityId === amenityId)?.selected
}

export function listMockAmenities(): Response {
  return HttpResponse.json({ success: true, data: { items: catalogue } })
}

/**
 * The same catalogue keyed by `id` instead of `amenityId`.
 *
 * The spec and the backend's hand-off note disagree on that field name, so the
 * client tolerates both. This serves the other shape, letting the normalisation
 * be proven against it rather than merely asserted.
 */
export function listMockAmenitiesLegacyIdShape(): Response {
  const items = catalogue.map(({ amenityId, ...rest }) => ({ id: amenityId, ...rest }))
  return HttpResponse.json({ success: true, data: { items } })
}

export function setMockAmenitySelected(amenityId: string, body: Record<string, unknown>): Response {
  if (mockProfile.status === 'PENDING') {
    return errorResponse('ERR_PROFILE_READ_ONLY', READ_ONLY_MESSAGE, 409, { status: 'PENDING' })
  }
  if (typeof body.selected !== 'boolean') {
    return errorResponse('ERR_VALIDATION', 'Invalid request.', 422)
  }

  const amenity = catalogue.find((item) => item.amenityId === amenityId)
  // Retired between list load and toggle — the race the client refetches on.
  if (!amenity) return errorResponse('ERR_NOT_FOUND', 'Amenity not found.', 404)

  // Idempotent: setting a state that already holds is a successful no-op, and
  // re-selecting reactivates rather than duplicating.
  amenity.selected = body.selected

  return HttpResponse.json({
    success: true,
    data: { amenityId, selected: amenity.selected },
  })
}
