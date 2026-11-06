import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../../mocks/server'
import { resetMockProfile } from '../../../../../../mocks/data/partnerRestaurantProfile'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import { PARTNER_PROFILE_ENDPOINTS } from '../../constants'
import type { PartnerRestaurantProfile } from '../../types'
import { useOverviewCards } from '../useOverviewCards'

const showSuccess = vi.fn()
const showError = vi.fn()
const showErrorText = vi.fn()

/**
 * A fully-populated profile; individual tests null out only what they care about.
 *
 * Overrides are merged per group, so a test can pass just the two location fields
 * it is exercising without restating the rest of the group.
 */
type ProfileOverrides = {
  [K in keyof PartnerRestaurantProfile]?: PartnerRestaurantProfile[K] extends object
    ? Partial<PartnerRestaurantProfile[K]>
    : PartnerRestaurantProfile[K]
}

function makeProfile(overrides: ProfileOverrides = {}): PartnerRestaurantProfile {
  const base = {
    id: 'r-1',
    name: 'Aurelia',
    status: 'DRAFT',
    cuisine: 'Levantine',
    description: 'A courtyard kitchen.',
    coverPhotoUrl: null,
    visibleOnApp: false,
    paymentConfigured: false,
    commissionRate: 12,
    editable: true,
    location: {
      fullAddress: '12 North Nazimabad St',
      areaDistrict: 'Korangi',
      city: 'Karachi',
      latitude: 25.1,
      longitude: 55.2,
    },
    restaurant: { phone: '+923001234567', email: 'hello@aurelia.pk', website: 'aurelia.pk' },
    owner: { name: 'Nadia Rahman', email: 'nadia@aurelia.pk', phone: '+923009876543' },
    rules: { houseRules: 'No smoking indoors.', dressCode: 'Smart casual', servesAlcohol: true },
    submissionReadiness: { missingFields: [], needsPayout: true, needsCoverPhoto: true },
    rejections: [],
  }

  return {
    ...base,
    ...overrides,
    location: { ...base.location, ...overrides.location },
    restaurant: { ...base.restaurant, ...overrides.restaurant },
    owner: { ...base.owner, ...overrides.owner },
    rules: { ...base.rules, ...overrides.rules },
  } as PartnerRestaurantProfile
}

/** Captures the PATCH body so each card can be checked for over-sending. */
function capturePatch() {
  const seen: { body?: Record<string, unknown> } = {}
  server.use(
    http.patch(`*${PARTNER_PROFILE_ENDPOINTS.restaurant}`, async ({ request }) => {
      seen.body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ success: true, data: makeProfile() })
    }),
  )
  return seen
}

function renderCards(profile: PartnerRestaurantProfile | undefined) {
  const queryClient = makeQueryClient()
  return renderHook(() => useOverviewCards(profile, { showSuccess, showError, showErrorText }), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
}

/** The ordinary case: a loaded, fully-populated profile. */
const renderLoaded = (overrides: ProfileOverrides = {}) => renderCards(makeProfile(overrides))

beforeEach(() => {
  resetMockProfile()
  showSuccess.mockClear()
  showError.mockClear()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('useOverviewCards opening', () => {
  it('starts with every card closed', () => {
    const { result } = renderLoaded()
    expect(result.current.openCard).toBeNull()
  })

  it('prefills Details from the profile', () => {
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('details'))
    expect(result.current.openCard).toBe('details')
    expect(result.current.details).toEqual({
      cuisine: 'Levantine',
      description: 'A courtyard kitchen.',
    })
  })

  /** Location spans two contract groups — the address and the contact details. */
  it('prefills Location from both groups', () => {
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('location'))
    expect(result.current.location).toEqual({
      fullAddress: '12 North Nazimabad St',
      areaDistrict: 'Korangi',
      city: 'Karachi',
      // Strings, so an empty field stays distinguishable from a legal 0.
      latitude: '25.1',
      longitude: '55.2',
      phone: '+923001234567',
      email: 'hello@aurelia.pk',
      website: 'aurelia.pk',
    })
  })

  /** 0 is a legal coordinate and must prefill as "0", not as an empty field. */
  it('prefills a zero coordinate rather than blanking it', () => {
    const { result } = renderLoaded({
      location: { fullAddress: 'x', areaDistrict: 'y', city: 'z', latitude: 0, longitude: 0 },
    })
    act(() => result.current.openCardModal('location'))

    expect(result.current.location.latitude).toBe('0')
    expect(result.current.location.longitude).toBe('0')
  })

  it('prefills absent coordinates as empty', () => {
    const { result } = renderLoaded({
      location: { fullAddress: 'x', areaDistrict: 'y', city: 'z', latitude: null, longitude: null },
    })
    act(() => result.current.openCardModal('location'))

    expect(result.current.location.latitude).toBe('')
    expect(result.current.location.longitude).toBe('')
  })

  it('prefills Owner from the profile', () => {
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('owner'))
    expect(result.current.owner).toEqual({
      name: 'Nadia Rahman',
      email: 'nadia@aurelia.pk',
      phone: '+923009876543',
    })
  })

  it('prefills Rules, keeping servesAlcohol a real boolean', () => {
    const { result } = renderLoaded({
      rules: { houseRules: 'None.', dressCode: 'Casual', servesAlcohol: false },
    })
    act(() => result.current.openCardModal('rules'))
    expect(result.current.rules).toEqual({
      houseRules: 'None.',
      dressCode: 'Casual',
      servesAlcohol: false,
    })
  })

  /** Unanswered is distinct from "no" and must not collapse into false. */
  it('keeps an unanswered servesAlcohol undefined', () => {
    const { result } = renderLoaded({
      rules: { houseRules: null, dressCode: null, servesAlcohol: null },
    })
    act(() => result.current.openCardModal('rules'))
    expect(result.current.rules.servesAlcohol).toBeUndefined()
  })

  it('maps nulls to empty strings so the inputs stay controlled', () => {
    const { result } = renderLoaded({ cuisine: null, description: null })
    act(() => result.current.openCardModal('details'))
    expect(result.current.details).toEqual({ cuisine: '', description: '' })
  })

  it('does nothing before the profile has loaded', () => {
    const { result } = renderCards(undefined)
    act(() => result.current.openCardModal('details'))
    expect(result.current.openCard).toBeNull()
  })

  it('closes on request', () => {
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('owner'))
    act(() => result.current.closeCard())
    expect(result.current.openCard).toBeNull()
  })
})

describe('useOverviewCards saving', () => {
  it('sends only the Details fields', async () => {
    const seen = capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('details'))
    act(() => result.current.saveDetails())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(seen.body).toEqual({ cuisine: 'Levantine', description: 'A courtyard kitchen.' })
  })

  it('nests Location into its two groups', async () => {
    const seen = capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('location'))
    act(() => result.current.saveLocation())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(seen.body).toEqual({
      location: {
        fullAddress: '12 North Nazimabad St',
        areaDistrict: 'Korangi',
        city: 'Karachi',
        // Sent as numbers, though the form holds them as strings.
        latitude: 25.1,
        longitude: 55.2,
      },
      restaurant: { phone: '+923001234567', email: 'hello@aurelia.pk', website: 'aurelia.pk' },
    })
  })

  /**
   * `gpsLocation` is a single mandatory entry covering both axes, so one
   * coordinate alone is refused rather than sent as half a location.
   */
  it('refuses one coordinate without the other, without sending anything', async () => {
    const seen = capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('location'))
    act(() => result.current.setLocation({ ...result.current.location, longitude: '' }))
    act(() => result.current.saveLocation())

    expect(result.current.errors.longitude).toBeTruthy()
    expect(result.current.blocked).toBe(true)
    expect(seen.body).toBeUndefined()
    expect(showSuccess).not.toHaveBeenCalled()
  })

  it('refuses an out-of-range coordinate', async () => {
    const seen = capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('location'))
    act(() => result.current.setLocation({ ...result.current.location, latitude: '91' }))
    act(() => result.current.saveLocation())

    expect(result.current.errors.latitude).toBeTruthy()
    expect(seen.body).toBeUndefined()
  })

  it('sends a zero coordinate pair rather than treating it as absent', async () => {
    const seen = capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('location'))
    act(() =>
      result.current.setLocation({ ...result.current.location, latitude: '0', longitude: '0' }),
    )
    act(() => result.current.saveLocation())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(seen.body).toMatchObject({ location: { latitude: 0, longitude: 0 } })
  })

  /** An empty group is dropped entirely rather than sent as `{}`. */
  it('omits the address group when only contact details were filled', async () => {
    const seen = capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('location'))
    act(() =>
      result.current.setLocation({
        fullAddress: '',
        areaDistrict: '',
        city: '',
        latitude: '',
        longitude: '',
        phone: '+923000000000',
        email: '',
        website: '',
      }),
    )
    act(() => result.current.saveLocation())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(seen.body).toEqual({ restaurant: { phone: '+923000000000' } })
  })

  it('omits the contact group when only the address was filled', async () => {
    const seen = capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('location'))
    act(() =>
      result.current.setLocation({
        fullAddress: '9 Clifton Boardwalk',
        areaDistrict: '',
        city: '',
        latitude: '',
        longitude: '',
        phone: '',
        email: '',
        website: '',
      }),
    )
    act(() => result.current.saveLocation())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(seen.body).toEqual({ location: { fullAddress: '9 Clifton Boardwalk' } })
  })

  it('nests Owner into its group', async () => {
    const seen = capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('owner'))
    act(() => result.current.saveOwner())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(seen.body).toEqual({
      owner: { name: 'Nadia Rahman', email: 'nadia@aurelia.pk', phone: '+923009876543' },
    })
  })

  it('sends an empty patch rather than an empty owner group', async () => {
    const seen = capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('owner'))
    act(() => result.current.setOwner({ name: '', email: '', phone: '' }))
    act(() => result.current.saveOwner())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(seen.body).toEqual({})
  })

  /** `servesAlcohol: false` is an answer; `omitEmpty` must not swallow it. */
  it('keeps servesAlcohol false in the patch', async () => {
    const seen = capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('rules'))
    act(() => result.current.setRules({ houseRules: '', dressCode: '', servesAlcohol: false }))
    act(() => result.current.saveRules())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(seen.body).toEqual({ rules: { servesAlcohol: false } })
  })

  it('omits servesAlcohol while it is unanswered', async () => {
    const seen = capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('rules'))
    act(() =>
      result.current.setRules({
        houseRules: 'No smoking.',
        dressCode: '',
        servesAlcohol: undefined,
      }),
    )
    act(() => result.current.saveRules())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(seen.body).toEqual({ rules: { houseRules: 'No smoking.' } })
  })

  it('sends an empty patch when Rules was left wholly blank', async () => {
    const seen = capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('rules'))
    act(() => result.current.setRules({ houseRules: '', dressCode: '', servesAlcohol: undefined }))
    act(() => result.current.saveRules())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(seen.body).toEqual({})
  })

  it('normalises a typed phone before sending', async () => {
    const seen = capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('location'))
    act(() =>
      result.current.setLocation({
        fullAddress: '',
        areaDistrict: '',
        city: '',
        latitude: '',
        longitude: '',
        phone: '+92 300 123 4567',
        email: '',
        website: '',
      }),
    )
    act(() => result.current.saveLocation())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(seen.body).toEqual({ restaurant: { phone: '+923001234567' } })
  })

  it('closes the modal on a successful save', async () => {
    capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('details'))
    act(() => result.current.saveDetails())

    await waitFor(() => {
      expect(result.current.openCard).toBeNull()
    })
  })

  /** A refused write keeps the modal open so the typing is not thrown away. */
  it('reports a refused write and keeps the modal open', async () => {
    server.use(
      http.patch(`*${PARTNER_PROFILE_ENDPOINTS.restaurant}`, () =>
        HttpResponse.json(
          { error: { code: 'ERR_PROFILE_READ_ONLY', message: 'Under review.' } },
          { status: 409 },
        ),
      ),
    )
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('details'))
    act(() => result.current.saveDetails())

    await waitFor(() => {
      expect(showError).toHaveBeenCalled()
    })
    expect(result.current.openCard).toBe('details')
    expect(showSuccess).not.toHaveBeenCalled()
  })
})

describe('useOverviewCards empty states', () => {
  it('marks every card filled for a complete profile', () => {
    const { result } = renderLoaded()
    expect(result.current.filled).toEqual({
      details: true,
      location: true,
      owner: true,
      rules: true,
    })
  })

  it('marks the cards empty for a fresh draft', () => {
    const { result } = renderLoaded({
      cuisine: null,
      description: null,
      location: {
        fullAddress: null,
        areaDistrict: null,
        city: null,
        latitude: null,
        longitude: null,
      },
      restaurant: { phone: null, email: null, website: null },
      owner: { name: null, email: null, phone: null },
      rules: { houseRules: null, dressCode: null, servesAlcohol: null },
    })
    expect(result.current.filled).toEqual({
      details: false,
      location: false,
      owner: false,
      rules: false,
    })
  })

  /** One filled field is enough to take a card out of its empty state. */
  it('counts Details filled on cuisine alone', () => {
    const { result } = renderLoaded({ cuisine: 'Levantine', description: null })
    expect(result.current.filled.details).toBe(true)
  })

  it('counts Location filled on a city alone', () => {
    const { result } = renderLoaded({
      location: { fullAddress: null, areaDistrict: null, city: 'Karachi' },
      restaurant: { phone: null, email: null, website: null },
    })
    expect(result.current.filled.location).toBe(true)
  })

  /** A phone with no address still counts — the card spans both groups. */
  it('counts Location filled on a phone alone', () => {
    const { result } = renderLoaded({
      location: { fullAddress: null, areaDistrict: null, city: null },
      restaurant: { phone: '+923001234567', email: null, website: null },
    })
    expect(result.current.filled.location).toBe(true)
  })

  /** Answering "no" is still an answer, so Rules is no longer empty. */
  it('counts Rules filled once servesAlcohol is answered false', () => {
    const { result } = renderLoaded({
      rules: { houseRules: null, dressCode: null, servesAlcohol: false },
    })
    expect(result.current.filled.rules).toBe(true)
  })

  /** All four must read empty before the profile lands, Rules included. */
  it('treats a missing profile as empty rather than crashing', () => {
    const { result } = renderCards(undefined)
    expect(result.current.filled).toEqual({
      details: false,
      location: false,
      owner: false,
      rules: false,
    })
  })
})

describe('useOverviewCards validation', () => {
  /** The documented rules should never cost a round trip. */
  it('refuses a phone with no country code, without sending anything', async () => {
    const seen = capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('owner'))
    act(() => result.current.setOwner({ ...result.current.owner, phone: '0501234567' }))
    act(() => result.current.saveOwner())

    expect(result.current.errors.phone).toBeTruthy()
    expect(seen.body).toBeUndefined()
    expect(showSuccess).not.toHaveBeenCalled()
    expect(showError).not.toHaveBeenCalled()
  })

  it('refuses an http:// website', async () => {
    const seen = capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('location'))
    act(() => result.current.setLocation({ ...result.current.location, website: 'http://a.pk' }))
    act(() => result.current.saveLocation())

    expect(result.current.errors.website).toBeTruthy()
    expect(seen.body).toBeUndefined()
  })

  it('refuses a dress code over the specified 200', async () => {
    const seen = capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('rules'))
    act(() => result.current.setRules({ ...result.current.rules, dressCode: 'x'.repeat(201) }))
    act(() => result.current.saveRules())

    expect(result.current.errors.dressCode).toBeTruthy()
    expect(seen.body).toBeUndefined()
  })

  it('sends a dress code of exactly 200 characters', async () => {
    const seen = capturePatch()
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('rules'))
    act(() => result.current.setRules({ ...result.current.rules, dressCode: 'x'.repeat(200) }))
    act(() => result.current.saveRules())

    await waitFor(() => expect(seen.body).toBeDefined())
    expect(result.current.errors.dressCode).toBeUndefined()
  })

  it('clears the errors as soon as a field is edited', async () => {
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('owner'))
    act(() => result.current.setOwner({ ...result.current.owner, phone: '123' }))
    act(() => result.current.saveOwner())
    expect(result.current.blocked).toBe(true)

    act(() => result.current.setOwner({ ...result.current.owner, phone: '+923001234567' }))

    expect(result.current.blocked).toBe(false)
  })

  it('clears the errors when the card is reopened', async () => {
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('owner'))
    act(() => result.current.setOwner({ ...result.current.owner, phone: '123' }))
    act(() => result.current.saveOwner())
    expect(result.current.blocked).toBe(true)

    act(() => result.current.openCardModal('owner'))

    expect(result.current.errors).toEqual({})
  })

  /**
   * The form mirrors every documented rule, so a 422 is client/server drift — and
   * it still has to point at the offending input. A toast alone would leave the
   * partner reading "correct the highlighted fields" with nothing highlighted.
   */
  it('maps a server 422 onto inline errors as well as a toast', async () => {
    server.use(
      http.patch(`*${PARTNER_PROFILE_ENDPOINTS.restaurant}`, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_VALIDATION',
              message: 'Please correct the highlighted fields.',
              details: { fields: { 'owner.phone': 'That number is already in use.' } },
            },
          },
          { status: 422 },
        ),
      ),
    )
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('owner'))
    act(() => result.current.saveOwner())

    await waitFor(() => {
      expect(result.current.errors.phone).toBe('That number is already in use.')
    })
    expect(showError).toHaveBeenCalled()
    // Left open so the partner can correct it without retyping the card.
    expect(result.current.openCard).toBe('owner')
  })

  it('leaves no stale inline errors after an unrelated failure', async () => {
    server.use(
      http.patch(`*${PARTNER_PROFILE_ENDPOINTS.restaurant}`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL', message: 'Something went wrong.' } },
          { status: 500 },
        ),
      ),
    )
    const { result } = renderLoaded()
    act(() => result.current.openCardModal('owner'))
    act(() => result.current.saveOwner())

    await waitFor(() => {
      expect(showError).toHaveBeenCalled()
    })
    // A 500 names no field, so nothing is highlighted — only the toast speaks.
    expect(result.current.errors).toEqual({})
  })
})
