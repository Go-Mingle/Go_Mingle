import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../mocks/server'
import {
  clearMockCoverPhoto,
  clearMockPayoutAccount,
  mockProfile,
  resetMockProfile,
  setMockAssignment,
  setMockCoverPhoto,
  setMockProfileStatus,
  setMockPayoutAccount,
} from '../../../../../mocks/data/partnerRestaurantProfile'
import { HttpError } from '../../../../../shared/api/httpClient'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { PARTNER_PROFILE_ENDPOINTS } from '../constants'
import { readSubmitBlockers } from '../errors'
import { partnerProfileService, sanitiseContactsParams } from '../services'
import type { UpdateProfileDto } from '../types'

beforeEach(() => {
  resetMockProfile()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('partnerProfileService.get', () => {
  it('returns the whole page in one call', async () => {
    const profile = await partnerProfileService.get()
    expect(profile.name).toBe('Aurelia')
    expect(profile.location.city).toBe('Karachi')
    expect(profile.owner.name).toBe('Osama Khalil')
    expect(profile.rules.servesAlcohol).toBe(true)
    expect(profile.coverPhotoUrl).toContain('https://')
  })

  it('points the cover at the photo the partner chose, on the CDN', async () => {
    setMockCoverPhoto('photos/photo-7.jpg')
    expect((await partnerProfileService.get()).coverPhotoUrl).toBe('https://cdn.mock.local/photo-7.jpg')
  })

  it('shows the category and commission GoMingle assigned on approval', async () => {
    setMockAssignment({ category: { id: 'c9', name: 'Casual' }, commissionPercent: 8 })
    const profile = await partnerProfileService.get()
    expect(profile.category).toEqual({ id: 'c9', name: 'Casual' })
    expect(profile.commissionPercent).toBe(8)
    setMockProfileStatus('PENDING')
    expect((await partnerProfileService.get()).category).toBeNull()
  })

  it('exposes editable rather than making the client re-derive it', async () => {
    expect((await partnerProfileService.get()).editable).toBe(true)
    setMockProfileStatus('PENDING')
    expect((await partnerProfileService.get()).editable).toBe(false)
  })

  it('carries readiness with canSubmit for the button binding', async () => {
    const { submissionReadiness } = await partnerProfileService.get()
    expect(submissionReadiness.canSubmit).toBe(true)
    expect(submissionReadiness.missingFields).toEqual([])
  })

  /** In a fresh Draft most fields are null — including the name. */
  it('returns nulls in a fresh Draft, not empty strings', async () => {
    setMockProfileStatus('DRAFT')
    const profile = await partnerProfileService.get()
    expect(profile.name).toBeNull()
    expect(profile.cuisine).toBeNull()
    expect(profile.location.latitude).toBeNull()
    expect(profile.coverPhotoUrl).toBeNull()
  })

  it('reports every missing mandatory field in a fresh Draft', async () => {
    setMockProfileStatus('DRAFT')
    const { submissionReadiness } = await partnerProfileService.get()
    expect(submissionReadiness.canSubmit).toBe(false)
    expect(submissionReadiness.missingFields).toContain('name')
    expect(submissionReadiness.missingFields).toContain('description')
  })

  /** GPS is one entry, not two — highlight the single map control. */
  it('reports gpsLocation as a single missing field', async () => {
    setMockProfileStatus('DRAFT')
    const { missingFields } = (await partnerProfileService.get()).submissionReadiness
    expect(missingFields).toContain('gpsLocation')
    expect(missingFields).not.toContain('latitude')
    expect(missingFields).not.toContain('longitude')
  })

  it('populates rejections only while REJECTED, newest first', async () => {
    setMockProfileStatus('REJECTED')
    const { rejections } = await partnerProfileService.get()
    expect(rejections).toHaveLength(2)
    // The wire shape, deliberately left as J6A sends it — the `YYYY-MM-DD`
    // normalisation belongs to the display layer (MET-1250).
    expect(rejections[0].rejectedAt).toBe('02-08-2026 14:20')
    // Never the declining admin's identity.
    expect(JSON.stringify(rejections)).not.toMatch(/admin/i)
  })

  it('leaves rejections empty in Active, even after a past decline', async () => {
    setMockProfileStatus('REJECTED')
    expect((await partnerProfileService.get()).rejections).toHaveLength(2)
    setMockProfileStatus('ACTIVE')
    expect((await partnerProfileService.get()).rejections).toEqual([])
  })

  it('throws on a 500', async () => {
    server.use(
      http.get(PARTNER_PROFILE_ENDPOINTS.restaurant, () => HttpResponse.json({}, { status: 500 })),
    )
    await expect(partnerProfileService.get()).rejects.toBeInstanceOf(HttpError)
  })
})

describe('partnerProfileService.update', () => {
  it('sends only the card fields given, leaving the rest untouched', async () => {
    const updated = await partnerProfileService.update({ cuisine: 'Levantine' })
    expect(updated.cuisine).toBe('Levantine')
    // Untouched by an absent key.
    expect(updated.description).toContain('Aurelia brings')
  })

  it('patches a nested card group', async () => {
    const updated = await partnerProfileService.update({
      owner: { name: 'Laiba Naseer', phone: '+923009999999' },
    })
    expect(updated.owner.name).toBe('Laiba Naseer')
    expect(updated.owner.email).toBe('osama@aurelia.pk')
  })

  /** Display spacing is rejected on the wire (E.164 only). */
  it('rejects a phone that still carries display spacing', async () => {
    await expect(
      partnerProfileService.update({ owner: { phone: '+92 300 123 4567' } }),
    ).rejects.toMatchObject({ status: 422 })
  })

  /** Dress Code is 200, per the J6A payload contract (MET-1248). */
  it('rejects a dress code over 200 characters', async () => {
    await expect(
      partnerProfileService.update({ rules: { dressCode: 'x'.repeat(201) } }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('accepts a dress code at exactly 200', async () => {
    const updated = await partnerProfileService.update({ rules: { dressCode: 'x'.repeat(200) } })
    expect(updated.rules.dressCode).toHaveLength(200)
  })

  it('refuses every write while PENDING', async () => {
    setMockProfileStatus('PENDING')
    await expect(partnerProfileService.update({ cuisine: 'Levantine' })).rejects.toMatchObject({
      status: 409,
      code: 'ERR_PROFILE_READ_ONLY',
    })
  })

  it('accepts visibleOnApp only while ACTIVE', async () => {
    setMockProfileStatus('DRAFT')
    await expect(partnerProfileService.update({ visibleOnApp: true })).rejects.toMatchObject({
      status: 422,
    })
  })

  it('blocks turning visibility on with no cover photo', async () => {
    clearMockCoverPhoto()
    await expect(partnerProfileService.update({ visibleOnApp: true })).rejects.toMatchObject({
      status: 422,
      code: 'ERR_COVER_PHOTO_REQUIRED',
    })
  })

  it('always allows turning visibility off', async () => {
    clearMockCoverPhoto()
    const updated = await partnerProfileService.update({ visibleOnApp: false })
    expect(updated.visibleOnApp).toBe(false)
  })

  /**
   * The spec's US-03 says to PATCH the new cover key here. The backend **removed**
   * it: the cover photo has exactly one writer, J6B's
   * `PATCH …/photos/{mediaId}/cover`, and sending the key returns a 422 rather
   * than being quietly ignored. Asserted so the field cannot creep back.
   */
  it('rejects mainPhotoKey — the cover photo is J6B’s to write', async () => {
    clearMockCoverPhoto()
    const error = (await partnerProfileService
      // Cast: the DTO no longer admits the field, which is the point.
      .update({ mainPhotoKey: 'restaurants/r-1/new.jpg' } as UpdateProfileDto)
      .catch((cause: unknown) => cause)) as HttpError

    expect(error.status).toBe(422)
    expect(error.code).toBe('ERR_VALIDATION')
    expect(mockProfile.mainPhotoKey).toBeNull()
  })

  /** Unknown keys are rejected, not ignored — the same applies to all of these. */
  it.each([['restaurantId'], ['status'], ['category'], ['commissionPercent']])(
    'rejects %s',
    async (key) => {
      const error = (await partnerProfileService
        .update({ [key]: 'anything' } as UpdateProfileDto)
        .catch((cause: unknown) => cause)) as HttpError

      expect(error.status).toBe(422)
    },
  )
})

describe('partnerProfileService.submit', () => {
  it('transitions to PENDING when the gate passes', async () => {
    setMockProfileStatus('DRAFT')
    // A fresh Draft has no payout account; only the webhook ever binds one, so
    // the fixture sets it directly rather than through any client call. The
    // cover photo is the same story — J6B's cover endpoint owns it, and this
    // PATCH rejects `mainPhotoKey` outright.
    setMockPayoutAccount()
    setMockCoverPhoto()
    await partnerProfileService.update({
      name: 'Aurelia',
      cuisine: 'Mediterranean',
      description: 'Coastal Mediterranean dining.',
      location: {
        fullAddress: 'Level 3, The Pier',
        areaDistrict: 'Clifton',
        city: 'Karachi',
        latitude: 25.08,
        longitude: 55.14,
      },
      owner: { name: 'Osama', email: 'osama@aurelia.pk', phone: '+923001234567' },
      restaurant: { phone: '+923001234568', email: 'hello@aurelia.pk' },
    })
    // The cover photo is J6B's to set, never this PATCH — the seeded fixture
    // already has one, which is what satisfies the gate's third condition.

    const result = await partnerProfileService.submit()
    expect(result.status).toBe('PENDING')
    expect(result.message).toMatch(/under review/i)
  })

  /** All three blockers arrive together, not one submit at a time. */
  it('returns every blocker in one 422', async () => {
    setMockProfileStatus('DRAFT')
    clearMockPayoutAccount()
    clearMockCoverPhoto()

    const error = await partnerProfileService.submit().catch((cause: unknown) => cause)
    const blockers = readSubmitBlockers(error)

    expect(blockers).not.toBeNull()
    expect(blockers?.missingFields?.length).toBeGreaterThan(0)
    expect(blockers?.needsPayout).toBe(true)
    expect(blockers?.needsCoverPhoto).toBe(true)
  })

  it('rejects a submit from PENDING with ERR_INVALID_STATE', async () => {
    setMockProfileStatus('PENDING')
    await expect(partnerProfileService.submit()).rejects.toMatchObject({
      status: 409,
      code: 'ERR_INVALID_STATE',
    })
  })

  it('hides the rejection history after a resubmit', async () => {
    setMockProfileStatus('REJECTED')
    expect((await partnerProfileService.get()).rejections).toHaveLength(2)
    await partnerProfileService.submit()
    expect((await partnerProfileService.get()).rejections).toEqual([])
  })
})

describe('partnerProfileService.saveDraft', () => {
  it('persists without enforcing the submission gate', async () => {
    setMockProfileStatus('DRAFT')
    const updated = await partnerProfileService.saveDraft({ cuisine: 'Levantine' })
    expect(updated.cuisine).toBe('Levantine')
    expect(updated.status).toBe('DRAFT')
    expect(updated.submissionReadiness.canSubmit).toBe(false)
  })

  it('is refused while PENDING', async () => {
    setMockProfileStatus('PENDING')
    await expect(partnerProfileService.saveDraft({ cuisine: 'x' })).rejects.toMatchObject({
      status: 409,
      code: 'ERR_PROFILE_READ_ONLY',
    })
  })
})

describe('partnerProfileService.createOnboardingLink', () => {
  it('returns UPDATE mode when an account is already bound', async () => {
    const { url, mode } = await partnerProfileService.createOnboardingLink()
    expect(url).toContain('sandbox.api.getsafepay.com')
    expect(mode).toBe('UPDATE')
  })

  it('returns ONBOARDING mode for first-time setup', async () => {
    clearMockPayoutAccount()
    expect((await partnerProfileService.createOnboardingLink()).mode).toBe('ONBOARDING')
  })

  /** AccountLinks are single-use — two calls must not return the same URL. */
  it('mints a fresh link every call', async () => {
    const first = await partnerProfileService.createOnboardingLink()
    const second = await partnerProfileService.createOnboardingLink()
    expect(first.url).not.toBe(second.url)
  })

  it('surfaces a payment-seam failure', async () => {
    server.use(
      http.post(PARTNER_PROFILE_ENDPOINTS.onboardingLink, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_PAYMENT_SEAM', message: "Couldn't start." } },
          { status: 502 },
        ),
      ),
    )
    await expect(partnerProfileService.createOnboardingLink()).rejects.toMatchObject({
      status: 502,
      code: 'ERR_PAYMENT_SEAM',
    })
  })
})

describe('contacts', () => {
  it('lists non-deleted contacts', async () => {
    const { items } = await partnerProfileService.listContacts()
    expect(items).toHaveLength(2)
  })

  it('sorts and searches per column', async () => {
    const sorted = await partnerProfileService.listContacts({ sortBy: 'name', sortOrder: 'desc' })
    expect(sorted.items[0].name).toBe('Sara Aziz')

    const searched = await partnerProfileService.listContacts({
      searchField: 'title',
      search: 'events',
    })
    expect(searched.items).toHaveLength(1)
  })

  /** A bad sort is a 422 here, not a silent default. */
  it('422s on a bad sort field', async () => {
    server.use(
      http.get(PARTNER_PROFILE_ENDPOINTS.contacts, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_VALIDATION', message: 'Invalid.' } },
          { status: 422 },
        ),
      ),
    )
    await expect(partnerProfileService.listContacts()).rejects.toMatchObject({ status: 422 })
  })

  it('creates a contact from a bare name', async () => {
    const created = await partnerProfileService.createContact({ name: 'Nadia Rahman' })
    expect(created.name).toBe('Nadia Rahman')
    expect(created.title).toBeNull()
  })

  it('rejects a contact with no name', async () => {
    await expect(partnerProfileService.createContact({ name: '  ' })).rejects.toMatchObject({
      status: 422,
    })
  })

  it('updates a contact', async () => {
    const updated = await partnerProfileService.updateContact('ct-2', { title: 'Head of Events' })
    expect(updated.title).toBe('Head of Events')
  })

  it('404s for an unknown contact', async () => {
    await expect(partnerProfileService.updateContact('nope', { name: 'X' })).rejects.toMatchObject({
      status: 404,
    })
  })

  it('soft-deletes and returns the deleted flag', async () => {
    await expect(partnerProfileService.deleteContact('ct-2')).resolves.toEqual({
      id: 'ct-2',
      deleted: true,
    })
    expect((await partnerProfileService.listContacts()).items).toHaveLength(1)
  })

  it('blocks deleting the only remaining contact', async () => {
    await partnerProfileService.deleteContact('ct-2')
    await expect(partnerProfileService.deleteContact('ct-1')).rejects.toMatchObject({
      status: 409,
      code: 'ERR_LAST_CONTACT',
    })
  })

  it('refuses contact writes while PENDING', async () => {
    setMockProfileStatus('PENDING')
    await expect(partnerProfileService.createContact({ name: 'X' })).rejects.toMatchObject({
      status: 409,
      code: 'ERR_PROFILE_READ_ONLY',
    })
  })
})

/** The 422-on-bad-value contract means unrecognised params are dropped, not sent. */
describe('sanitiseContactsParams', () => {
  it('keeps valid params', () => {
    expect(sanitiseContactsParams({ sortBy: 'email', sortOrder: 'desc' })).toEqual({
      sortBy: 'email',
      sortOrder: 'desc',
    })
  })

  it('drops an unsupported sort field', () => {
    expect(sanitiseContactsParams({ sortBy: 'createdAt' }).sortBy).toBeUndefined()
  })

  it('drops an invalid sort order', () => {
    expect(sanitiseContactsParams({ sortOrder: 'sideways' }).sortOrder).toBeUndefined()
  })

  it('drops a term with no field, and a field with no term', () => {
    expect(sanitiseContactsParams({ search: 'osama' })).toEqual({})
    expect(sanitiseContactsParams({ searchField: 'name' })).toEqual({})
  })

  it('trims the term', () => {
    expect(sanitiseContactsParams({ searchField: 'name', search: '  osama ' }).search).toBe('osama')
  })

  it('returns nothing for empty input', () => {
    expect(sanitiseContactsParams()).toEqual({})
  })
})
