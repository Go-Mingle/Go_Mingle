/**
 * CR-45 — DRAFT restaurants are excluded from every Admin read surface (F1 BR-09).
 *
 * These run against the *default* MSW handlers rather than per-test
 * `server.use()` overrides: the point is to pin the mocked contract itself to
 * the tightened backend contract, so a drifting mock fails here instead of
 * silently letting the app pass tests it would fail against the real API.
 */
import { describe, it, expect } from 'vitest'
import { restaurantsService } from '../services'
import { DIRECTORY_STATUSES } from '../constants'
import type { RestaurantDirectoryStatus } from '../restaurantApi.types'
import { HttpError } from '../../../../shared/api/httpClient'
import { mockRestaurants } from '../../../../mocks/data/index'

/**
 * `statuses[]` is typed to the allow-list, so an out-of-range value can only be
 * produced by a stale caller or a hand-built URL. Casting reproduces exactly
 * that, which is what the 422 defends against.
 */
const asStatuses = (values: string[]) => values as RestaurantDirectoryStatus[]

/** Asserts the call rejects with an HttpError and hands it back for inspection. */
async function expectHttpError(p: Promise<unknown>): Promise<HttpError> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(HttpError)
  return err as HttpError
}

const DRAFT_ID = 'rest11'
const PENDING_ID = 'rest10'
const ACTIVE_ID = 'rest1'

// Fixture-derived rather than hardcoded, so adding fixtures never breaks this.
const isDirectoryStatus = (s: string) => (DIRECTORY_STATUSES as readonly string[]).includes(s)
const visibleFixtures = mockRestaurants.filter((r) => isDirectoryStatus(r.status))
const hiddenFixtures = mockRestaurants.filter((r) => !isDirectoryStatus(r.status))

describe('CR-45 · GET /api/v1/restaurants — directory base filter (AC-1, AC-6)', () => {
  it('has fixtures on both sides of the filter, so the assertions below are meaningful', () => {
    expect(visibleFixtures.length).toBeGreaterThan(0)
    expect(hiddenFixtures.map((r) => r.status).sort()).toEqual(['DRAFT', 'PENDING'])
  })

  it('serves only ACTIVE and SUSPENDED rows', async () => {
    const res = await restaurantsService.listRestaurants({ pageSize: 50 })
    expect(res.items.length).toBeGreaterThan(0)
    for (const item of res.items) {
      expect(DIRECTORY_STATUSES).toContain(item.status)
    }
  })

  it('omits the DRAFT and PENDING restaurants entirely', async () => {
    const res = await restaurantsService.listRestaurants({ pageSize: 50 })
    const ids = res.items.map((r) => r.id)
    for (const hidden of hiddenFixtures) {
      expect(ids).not.toContain(hidden.id)
    }
    expect(ids).toContain(ACTIVE_ID)
  })

  it('counts and pagination totals reflect the base filter, not the full fixture set', async () => {
    const res = await restaurantsService.listRestaurants({ pageSize: 50 })
    expect(res.pagination.totalRecords).toBe(visibleFixtures.length)
    expect(res.pagination.totalRecords).toBeLessThan(mockRestaurants.length)
    expect(res.items).toHaveLength(visibleFixtures.length)
  })

  it('paginates over the filtered set', async () => {
    const first = await restaurantsService.listRestaurants({ page: 1, pageSize: 10 })
    expect(first.pagination.totalRecords).toBe(visibleFixtures.length)
    expect(first.pagination.totalPages).toBe(Math.ceil(visibleFixtures.length / 10))
  })
})

describe('CR-45 · GET /api/v1/restaurants — statuses[] allow-list (AC-2)', () => {
  it.each(DIRECTORY_STATUSES)('accepts %s and narrows within the base filter', async (status) => {
    const res = await restaurantsService.listRestaurants({ pageSize: 50, statuses: [status] })
    expect(res.items.length).toBeGreaterThan(0)
    for (const item of res.items) {
      expect(item.status).toBe(status)
    }
  })

  it('accepts the full allow-list and returns the same set as no filter at all', async () => {
    const filtered = await restaurantsService.listRestaurants({
      pageSize: 50,
      statuses: ['ACTIVE', 'SUSPENDED'],
    })
    const unfiltered = await restaurantsService.listRestaurants({ pageSize: 50 })
    expect(filtered.pagination.totalRecords).toBe(unfiltered.pagination.totalRecords)
  })

  it.each(['PENDING', 'REJECTED', 'DRAFT'])(
    'rejects %s with 422 ERR_VALIDATION instead of an empty page',
    async (status) => {
      const err = await expectHttpError(
        restaurantsService.listRestaurants({ statuses: asStatuses([status]) }),
      )
      expect(err.status).toBe(422)
      expect(err.code).toBe('ERR_VALIDATION')
    },
  )

  it('rejects a mixed list containing one disallowed status', async () => {
    const err = await expectHttpError(
      restaurantsService.listRestaurants({ statuses: asStatuses(['ACTIVE', 'PENDING']) }),
    )
    expect(err.status).toBe(422)
  })

  it('DRAFT cannot widen the base filter — it errors rather than surfacing the row', async () => {
    await expect(
      restaurantsService.listRestaurants({ statuses: asStatuses(['DRAFT']) }),
    ).rejects.toBeInstanceOf(HttpError)
  })
})

describe('CR-45 · per-restaurant reads 404 on DRAFT (AC-4)', () => {
  const reads: [string, (id: string) => Promise<unknown>][] = [
    ['detail', (id) => restaurantsService.getRestaurantDetail(id)],
    ['tables', (id) => restaurantsService.getRestaurantTables(id)],
    ['menu-options', (id) => restaurantsService.getMenuOptions(id)],
    ['amenities', (id) => restaurantsService.getAmenities(id)],
    ['media', (id) => restaurantsService.getMedia(id, 'PHOTO')],
    ['bookings/count-active', (id) => restaurantsService.getActiveBookingsCount(id)],
  ]

  it.each(reads)('%s returns 404 for a DRAFT restaurant', async (_name, read) => {
    const err = await expectHttpError(read(DRAFT_ID))
    expect(err.status).toBe(404)
    expect(err.code).toBe('ERR_RESTAURANT_NOT_FOUND')
  })

  it.each(reads)('%s still resolves for a PENDING restaurant', async (_name, read) => {
    await expect(read(PENDING_ID)).resolves.toBeDefined()
  })

  it.each(reads)('%s still resolves for an ACTIVE restaurant', async (_name, read) => {
    await expect(read(ACTIVE_ID)).resolves.toBeDefined()
  })

  it('a DRAFT restaurant is indistinguishable from a non-existent one', async () => {
    const draftErr = await expectHttpError(restaurantsService.getRestaurantDetail(DRAFT_ID))
    const missingErr = await expectHttpError(
      restaurantsService.getRestaurantDetail('no-such-restaurant'),
    )

    expect(draftErr.status).toBe(missingErr.status)
    expect(draftErr.code).toBe(missingErr.code)
  })

  it('the pre-approval detail shell still gets its PENDING restaurant (spec §2.1)', async () => {
    const detail = await restaurantsService.getRestaurantDetail(PENDING_ID)
    expect(detail.id).toBe(PENDING_ID)
    expect(detail.status).toBe('PENDING')
  })
})
