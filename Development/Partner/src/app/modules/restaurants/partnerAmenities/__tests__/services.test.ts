import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../mocks/server'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../mocks/data/partnerRestaurantProfile'
import {
  listMockAmenitiesLegacyIdShape,
  mockAmenitySelected,
  resetMockAmenities,
  retireMockAmenity,
} from '../../../../../mocks/data/partnerAmenities'
import { HttpError } from '../../../../../shared/api/httpClient'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { PARTNER_AMENITIES_ENDPOINTS } from '../constants'
import { normaliseAmenity, partnerAmenitiesService } from '../services'

beforeEach(() => {
  resetMockProfile()
  resetMockAmenities()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('normaliseAmenity', () => {
  /**
   * Spec §184 documents `amenityId`; the backend hand-off note shows `id`. That
   * value builds the toggle's PUT path, so both are accepted until the backend
   * confirms which it sends.
   */
  it('reads the spec shape', () => {
    expect(
      normaliseAmenity({ amenityId: 'a1', name: 'Wi-Fi free', iconUrl: 'u', selected: true }),
    ).toEqual({ amenityId: 'a1', name: 'Wi-Fi free', iconUrl: 'u', selected: true })
  })

  it('reads the hand-off shape', () => {
    expect(
      normaliseAmenity({ id: 'a1', name: 'Wi-Fi free', iconUrl: 'u', selected: true }),
    ).toEqual({ amenityId: 'a1', name: 'Wi-Fi free', iconUrl: 'u', selected: true })
  })

  it('prefers amenityId when both are present', () => {
    expect(normaliseAmenity({ amenityId: 'spec', id: 'legacy' }).amenityId).toBe('spec')
  })

  it('coerces a missing selected to false rather than undefined', () => {
    expect(normaliseAmenity({ amenityId: 'a1' }).selected).toBe(false)
  })

  it('defaults the display fields so a row never renders undefined', () => {
    expect(normaliseAmenity({ amenityId: 'a1' })).toEqual({
      amenityId: 'a1',
      name: '',
      iconUrl: '',
      selected: false,
    })
  })
})

describe('list', () => {
  it('returns the catalogue with selection flags', async () => {
    const { items } = await partnerAmenitiesService.list()

    expect(items.length).toBeGreaterThan(0)
    expect(items.some((item) => item.selected)).toBe(true)
    expect(items.some((item) => !item.selected)).toBe(true)
  })

  /** One call gives the whole tab — there is no separate "my amenities" read. */
  it('carries the id, name, icon and flag on every item', async () => {
    const { items } = await partnerAmenitiesService.list()

    items.forEach((item) => {
      expect(item.amenityId).toBeTruthy()
      expect(item.name).toBeTruthy()
      expect(typeof item.selected).toBe('boolean')
    })
  })

  /** Proven against the other shape, not merely asserted in the abstract. */
  it('parses a payload keyed by id instead of amenityId', async () => {
    server.use(
      http.get(`*${PARTNER_AMENITIES_ENDPOINTS.list}`, () => listMockAmenitiesLegacyIdShape()),
    )

    const { items } = await partnerAmenitiesService.list()
    expect(items.length).toBeGreaterThan(0)
    items.forEach((item) => {
      expect(item.amenityId).toBeTruthy()
    })
  })

  /**
   * A row with no usable id could not be toggled, and a switch that silently
   * does nothing is worse than an absent row.
   */
  it('drops an item that carries no usable id', async () => {
    server.use(
      http.get(`*${PARTNER_AMENITIES_ENDPOINTS.list}`, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              { amenityId: 'a1', name: 'Keeps', iconUrl: 'u', selected: false },
              { name: 'No id at all', iconUrl: 'u', selected: true },
            ],
          },
        }),
      ),
    )

    const { items } = await partnerAmenitiesService.list()
    expect(items.map((item) => item.name)).toEqual(['Keeps'])
  })

  it('survives a payload with no items key', async () => {
    server.use(
      http.get(`*${PARTNER_AMENITIES_ENDPOINTS.list}`, () =>
        HttpResponse.json({ success: true, data: {} }),
      ),
    )
    await expect(partnerAmenitiesService.list()).resolves.toEqual({ items: [] })
  })

  it('sends no search param — filtering is client-side', async () => {
    let url = ''
    server.use(
      http.get(`*${PARTNER_AMENITIES_ENDPOINTS.list}`, ({ request }) => {
        url = request.url
        return HttpResponse.json({ success: true, data: { items: [] } })
      }),
    )

    await partnerAmenitiesService.list()
    expect(url).not.toContain('?')
  })

  it('surfaces a failed read', async () => {
    server.use(
      http.get(`*${PARTNER_AMENITIES_ENDPOINTS.list}`, () =>
        HttpResponse.json({ error: { code: 'ERR_INTERNAL', message: 'nope' } }, { status: 500 }),
      ),
    )
    const error = (await partnerAmenitiesService.list().catch((e: unknown) => e)) as HttpError
    expect(error).toBeInstanceOf(HttpError)
  })
})

describe('setSelected', () => {
  it('assigns an amenity and echoes the resulting state', async () => {
    await expect(partnerAmenitiesService.setSelected('a2', true)).resolves.toEqual({
      amenityId: 'a2',
      selected: true,
    })
    expect(mockAmenitySelected('a2')).toBe(true)
  })

  it('un-assigns an amenity', async () => {
    await expect(partnerAmenitiesService.setSelected('a1', false)).resolves.toEqual({
      amenityId: 'a1',
      selected: false,
    })
    expect(mockAmenitySelected('a1')).toBe(false)
  })

  /**
   * Idempotent in both directions, so a double-tap or a retry is safe and needs
   * no client-side guard.
   */
  it.each([
    ['already on', 'a1', true],
    ['already off', 'a2', false],
  ] as const)('is a no-op success when %s', async (_label, amenityId, selected) => {
    await expect(partnerAmenitiesService.setSelected(amenityId, selected)).resolves.toMatchObject({
      selected,
    })
    expect(mockAmenitySelected(amenityId)).toBe(selected)
  })

  it('reactivates rather than duplicating on re-assign', async () => {
    await partnerAmenitiesService.setSelected('a1', false)
    await partnerAmenitiesService.setSelected('a1', true)

    const { items } = await partnerAmenitiesService.list()
    expect(items.filter((item) => item.amenityId === 'a1')).toHaveLength(1)
    expect(mockAmenitySelected('a1')).toBe(true)
  })

  it('sends the flag in the body', async () => {
    let body: unknown
    server.use(
      http.put(`*${PARTNER_AMENITIES_ENDPOINTS.list}/:id`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: { amenityId: 'a1', selected: true } })
      }),
    )

    await partnerAmenitiesService.setSelected('a1', true)
    expect(body).toEqual({ selected: true })
  })

  /** The admin can retire an amenity while the tab is open (BR-05). */
  it('404s for an amenity retired since the list loaded', async () => {
    retireMockAmenity('a1')
    const error = (await partnerAmenitiesService
      .setSelected('a1', true)
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(404)
    expect(error.code).toBe('ERR_NOT_FOUND')
  })

  it('422s on a non-boolean flag', async () => {
    server.use(
      http.put(`*${PARTNER_AMENITIES_ENDPOINTS.list}/:id`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_VALIDATION', message: 'Invalid request.' } },
          { status: 422 },
        ),
      ),
    )
    const error = (await partnerAmenitiesService
      .setSelected('a1', true)
      .catch((e: unknown) => e)) as HttpError
    expect(error.status).toBe(422)
  })
})

describe('read-only while under review (BR-07)', () => {
  beforeEach(() => {
    setMockProfileStatus('PENDING')
  })

  it('refuses the write with ERR_PROFILE_READ_ONLY', async () => {
    const error = (await partnerAmenitiesService
      .setSelected('a2', true)
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(409)
    expect(error.code).toBe('ERR_PROFILE_READ_ONLY')
    expect(mockAmenitySelected('a2')).toBe(false)
  })

  /** The list still renders; only the writes are refused. */
  it('still allows the read', async () => {
    const { items } = await partnerAmenitiesService.list()
    expect(items.length).toBeGreaterThan(0)
  })
})
