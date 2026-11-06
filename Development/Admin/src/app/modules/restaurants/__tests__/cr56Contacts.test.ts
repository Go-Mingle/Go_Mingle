/**
 * CR-56 — GET /api/v1/restaurants/{id}/contacts, the Contacts tab's data source.
 *
 * These run against the *default* MSW handlers rather than per-test
 * `server.use()` overrides: the point is to pin the mocked contract itself to
 * the backend contract, so a drifting mock fails here instead of silently
 * letting the app pass tests it would fail against the real API.
 */
import { describe, it, expect } from 'vitest'
import { restaurantsService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'
import { mockRestaurants } from '../../../../mocks/data/index'

/** Asserts the call rejects with an HttpError and hands it back for inspection. */
async function expectHttpError(p: Promise<unknown>): Promise<HttpError> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(HttpError)
  return err as HttpError
}

const POPULATED_ID = 'rest1'
/** A readable restaurant with no contacts — contacts are optional (AC-5). */
const NO_CONTACTS_ID = 'rest9'
const PENDING_ID = 'rest10'
const DRAFT_ID = 'rest11'

describe('CR-56 · GET /api/v1/restaurants/{id}/contacts', () => {
  it('has fixtures on both sides of the empty/populated split, so the assertions below are meaningful', () => {
    const populated = mockRestaurants.find((r) => r.id === POPULATED_ID)
    const empty = mockRestaurants.find((r) => r.id === NO_CONTACTS_ID)
    expect(populated?.contacts.length).toBeGreaterThan(0)
    expect(empty?.contacts).toEqual([])
    expect(empty?.status).toBe('SUSPENDED')
  })

  it('returns the contacts ordered by name ascending (AC-3)', async () => {
    const res = await restaurantsService.getContacts(POPULATED_ID)
    expect(res.items.length).toBeGreaterThan(1)
    const names = res.items.map((c) => c.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  it('sends every field on every contact, with null for the optional ones (AC-6)', async () => {
    const res = await restaurantsService.getContacts(POPULATED_ID)
    for (const contact of res.items) {
      expect(typeof contact.id).toBe('string')
      expect(typeof contact.name).toBe('string')
      expect(contact.name.length).toBeGreaterThan(0)
      // The keys are always present; their values may be null.
      expect(contact).toHaveProperty('title')
      expect(contact).toHaveProperty('email')
      expect(contact).toHaveProperty('phone')
    }
    // At least one contact exercises the nullable branch.
    expect(res.items.some((c) => c.title === null && c.email === null && c.phone === null)).toBe(
      true,
    )
  })

  it('resolves with an empty array — not a 404 — when a restaurant has no contacts (AC-5)', async () => {
    await expect(restaurantsService.getContacts(NO_CONTACTS_ID)).resolves.toEqual({ items: [] })
  })

  it('resolves for a PENDING restaurant, like every other detail-tab read', async () => {
    await expect(restaurantsService.getContacts(PENDING_ID)).resolves.toHaveProperty('items')
  })

  it('404s for a DRAFT restaurant, like every other detail-tab read', async () => {
    const err = await expectHttpError(restaurantsService.getContacts(DRAFT_ID))
    expect(err.status).toBe(404)
    expect(err.code).toBe('ERR_RESTAURANT_NOT_FOUND')
  })

  it('404s for an unknown restaurant id', async () => {
    const err = await expectHttpError(restaurantsService.getContacts('does-not-exist'))
    expect(err.status).toBe(404)
  })
})
