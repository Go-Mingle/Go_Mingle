import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../mocks/server'
import { HttpError } from '../../../../../shared/api/httpClient'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../mocks/data/partnerRestaurantProfile'
import {
  clearMockTables,
  markTableInUse,
  mockTable,
  mockTableCount,
  releaseTable,
  resetMockTables,
} from '../../../../../mocks/data/partnerTables'
import { PARTNER_TABLES_ENDPOINTS } from '../constants'
import { partnerTablesService } from '../services'
import { emptyAvailability } from '../format'
import type { TableAvailability, TableDraft } from '../types'

const LIST = PARTNER_TABLES_ENDPOINTS.tables

/** The seven-key shape every write sends, with the named days opened. */
function availability(open: Partial<TableAvailability> = {}): TableAvailability {
  return { ...emptyAvailability(), ...open }
}

function draft(overrides: Partial<TableDraft> = {}): TableDraft {
  return {
    name: 'Rooftop Deck',
    availability: availability({ '5': [{ start: '18:00', end: '23:00' }] }),
    ...overrides,
  }
}

/** Resolves to the thrown HttpError, for tests that assert on the body. */
const caught = (promise: Promise<unknown>) =>
  promise.catch((error: unknown) => error) as Promise<HttpError>

beforeEach(() => {
  // The profile status gates every write, and `setMockProfileStatus('PENDING')`
  // would otherwise leak into the next test — the global reset in setupTests
  // covers the J2 account fixture, not this one.
  resetMockProfile()
  resetMockTables()
  // Without a session `httpClient` sends no Bearer header and the session policy
  // takes a different branch — every partner service test needs one.
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 1 })
})

describe('partnerTablesService.listTables', () => {
  it('reads the grid, hidden tables included', async () => {
    const { items } = await partnerTablesService.listTables()

    expect(items).toHaveLength(4)
    expect(items.map((table) => table.tableId)).toEqual(['t1', 't2', 't3', 't4'])
    // Hidden tables stay in the list; the tab badges them (AC-01.2).
    expect(items.find((table) => table.tableId === 't3')?.isHidden).toBe(true)
  })

  it('returns all seven weekday keys on every table', async () => {
    const { items } = await partnerTablesService.listTables()

    items.forEach((table) => {
      expect(Object.keys(table.availability).sort()).toEqual(['0', '1', '2', '3', '4', '5', '6'])
    })
  })

  it('keys each table by tableId, not id', async () => {
    const { items } = await partnerTablesService.listTables()

    expect(items[0]).toHaveProperty('tableId')
    expect(items[0]).not.toHaveProperty('id')
  })

  it('returns an empty list rather than failing when there are no tables', async () => {
    clearMockTables()

    await expect(partnerTablesService.listTables()).resolves.toEqual({ items: [] })
  })

  it('still works while the profile is PENDING, so the tab can render read-only', async () => {
    setMockProfileStatus('PENDING')

    await expect(partnerTablesService.listTables()).resolves.toMatchObject({
      items: expect.any(Array),
    })
  })

  it('throws an HttpError on a 500', async () => {
    server.use(http.get(LIST, () => HttpResponse.json({}, { status: 500 })))

    await expect(partnerTablesService.listTables()).rejects.toBeInstanceOf(HttpError)
  })
})

describe('partnerTablesService.createTable', () => {
  it('creates the table and its windows, returning it in the list shape', async () => {
    const created = await partnerTablesService.createTable(draft())

    expect(created).toMatchObject({ name: 'Rooftop Deck', isHidden: false })
    expect(created.tableId).toBeTruthy()
    expect(created.availability['5']).toEqual([{ start: '18:00', end: '23:00' }])
    expect(mockTableCount()).toBe(5)
  })

  it('accepts a table with no hours at all', async () => {
    const created = await partnerTablesService.createTable({
      name: 'Overflow Area',
      availability: emptyAvailability(),
    })

    expect(Object.values(created.availability).every((ranges) => ranges.length === 0)).toBe(true)
  })

  it('accepts several non-overlapping ranges on one day', async () => {
    const created = await partnerTablesService.createTable(
      draft({
        availability: availability({
          '3': [
            { start: '12:00', end: '15:00' },
            // Touching the previous range's end is allowed.
            { start: '15:00', end: '18:00' },
          ],
        }),
      }),
    )

    expect(created.availability['3']).toHaveLength(2)
  })

  it('surfaces the duplicate name as a 409 with its code and field intact', async () => {
    await expect(
      partnerTablesService.createTable(draft({ name: 'Garden Patio' })),
    ).rejects.toMatchObject({ status: 409, code: 'ERR_TABLE_NAME_DUPLICATE' })
  })

  it('collides case-insensitively, as the backend does', async () => {
    await expect(
      partnerTablesService.createTable(draft({ name: 'garden PATIO' })),
    ).rejects.toMatchObject({ status: 409, code: 'ERR_TABLE_NAME_DUPLICATE' })
  })

  it('carries details.field on the duplicate so the client can pin it to the input', async () => {
    const error = await caught(partnerTablesService.createTable(draft({ name: 'Garden Patio' })))

    expect(error.responseBody).toMatchObject({ error: { details: { field: 'name' } } })
  })

  it.each([
    ['a missing name', { name: '' }],
    ['a name over 150 characters', { name: 'a'.repeat(151) }],
  ])('rejects %s as a 422', async (_label, overrides) => {
    await expect(partnerTablesService.createTable(draft(overrides))).rejects.toMatchObject({
      status: 422,
      code: 'ERR_VALIDATION',
    })
  })

  it('rejects an end that is not after the start, reporting the exact range', async () => {
    const error = await caught(
      partnerTablesService.createTable(
        draft({ availability: availability({ '2': [{ start: '18:00', end: '17:00' }] }) }),
      ),
    )

    expect(error.status).toBe(422)
    expect(error.responseBody).toMatchObject({
      error: { details: { fields: { 'availability.2[0].end': expect.any(String) } } },
    })
  })

  it('rejects a cross-midnight range', async () => {
    await expect(
      partnerTablesService.createTable(
        draft({ availability: availability({ '2': [{ start: '22:00', end: '02:00' }] }) }),
      ),
    ).rejects.toMatchObject({ status: 422, code: 'ERR_VALIDATION' })
  })

  it('rejects overlapping ranges on the same day, reporting the day', async () => {
    const error = await caught(
      partnerTablesService.createTable(
        draft({
          availability: availability({
            '2': [
              { start: '15:00', end: '17:00' },
              { start: '16:00', end: '18:00' },
            ],
          }),
        }),
      ),
    )

    expect(error.responseBody).toMatchObject({
      error: { details: { fields: { 'availability.2': expect.any(String) } } },
    })
  })

  it('rejects more than six ranges on one day', async () => {
    const seven = Array.from({ length: 7 }, (_, index) => ({
      start: `0${String(index)}:00`,
      end: `0${String(index)}:30`,
    }))

    await expect(
      partnerTablesService.createTable(draft({ availability: availability({ '2': seven }) })),
    ).rejects.toMatchObject({ status: 422, code: 'ERR_VALIDATION' })
  })

  it('rejects an unpadded time — HH:MM is strict', async () => {
    await expect(
      partnerTablesService.createTable(
        draft({ availability: availability({ '2': [{ start: '9:00', end: '11:00' }] }) }),
      ),
    ).rejects.toMatchObject({ status: 422, code: 'ERR_VALIDATION' })
  })

  it('rejects a weekday key outside 0–6 rather than ignoring it', async () => {
    // The backend was explicit: "7" or "mon" is a 422, not silently dropped.
    await expect(
      partnerTablesService.createTable({
        name: 'Rooftop Deck',
        availability: { '7': [{ start: '18:00', end: '23:00' }] } as unknown as TableAvailability,
      }),
    ).rejects.toMatchObject({ status: 422, code: 'ERR_VALIDATION' })
  })

  it('rejects an unknown top-level field rather than ignoring it', async () => {
    await expect(
      partnerTablesService.createTable({
        name: 'Rooftop Deck',
        availability: emptyAvailability(),
        seats: 6,
      } as unknown as TableDraft),
    ).rejects.toMatchObject({ status: 422, code: 'ERR_VALIDATION' })
  })

  it('is refused with 409 ERR_PROFILE_READ_ONLY while PENDING', async () => {
    setMockProfileStatus('PENDING')

    await expect(partnerTablesService.createTable(draft())).rejects.toMatchObject({
      status: 409,
      code: 'ERR_PROFILE_READ_ONLY',
    })
  })
})

describe('partnerTablesService.updateTable', () => {
  it('renames the table and replaces its whole week', async () => {
    const updated = await partnerTablesService.updateTable('t1', {
      name: 'Window Nook',
      availability: availability({ '6': [{ start: '09:00', end: '12:00' }] }),
    })

    expect(updated.name).toBe('Window Nook')
    expect(updated.availability['6']).toEqual([{ start: '09:00', end: '12:00' }])
    // Monday held two ranges before; a replace clears every day not sent.
    expect(updated.availability['1']).toEqual([])
  })

  it('leaves isHidden alone — visibility has its own endpoint', async () => {
    const updated = await partnerTablesService.updateTable('t3', draft({ name: "Chef's Table" }))

    expect(updated.isHidden).toBe(true)
  })

  it('lets a table keep its own name', async () => {
    await expect(
      partnerTablesService.updateTable('t2', draft({ name: 'Garden Patio' })),
    ).resolves.toMatchObject({ tableId: 't2', name: 'Garden Patio' })
  })

  it('refuses a rename that collides with another table', async () => {
    await expect(
      partnerTablesService.updateTable('t1', draft({ name: 'Garden Patio' })),
    ).rejects.toMatchObject({ status: 409, code: 'ERR_TABLE_NAME_DUPLICATE' })
  })

  it("404s for a table that is not the caller's", async () => {
    await expect(partnerTablesService.updateTable('t-nope', draft())).rejects.toMatchObject({
      status: 404,
      code: 'ERR_NOT_FOUND',
    })
  })

  it('validates the ranges the same way create does', async () => {
    await expect(
      partnerTablesService.updateTable('t1', {
        name: 'Window Table',
        availability: availability({ '2': [{ start: '18:00', end: '17:00' }] }),
      }),
    ).rejects.toMatchObject({ status: 422, code: 'ERR_VALIDATION' })
  })

  it('is refused while PENDING', async () => {
    setMockProfileStatus('PENDING')

    await expect(partnerTablesService.updateTable('t1', draft())).rejects.toMatchObject({
      status: 409,
      code: 'ERR_PROFILE_READ_ONLY',
    })
  })
})

describe('partnerTablesService.setTableVisibility', () => {
  it('hides a table, answering with isHidden even though it was sent hidden', async () => {
    await expect(partnerTablesService.setTableVisibility('t1', true)).resolves.toEqual({
      tableId: 't1',
      isHidden: true,
    })
    expect(mockTable('t1')?.isHidden).toBe(true)
  })

  it('shows a hidden table again', async () => {
    await expect(partnerTablesService.setTableVisibility('t3', false)).resolves.toEqual({
      tableId: 't3',
      isHidden: false,
    })
  })

  it('sends the flag under `hidden`, not `isHidden`', async () => {
    let body: unknown
    server.use(
      http.patch(PARTNER_TABLES_ENDPOINTS.tableVisibility(':tableId'), async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: { tableId: 't1', isHidden: true } })
      }),
    )

    await partnerTablesService.setTableVisibility('t1', true)

    expect(body).toEqual({ hidden: true })
  })

  it('is idempotent, so a double-tap is safe', async () => {
    await partnerTablesService.setTableVisibility('t1', true)

    await expect(partnerTablesService.setTableVisibility('t1', true)).resolves.toEqual({
      tableId: 't1',
      isHidden: true,
    })
  })

  it('404s for an unknown table', async () => {
    await expect(partnerTablesService.setTableVisibility('t-nope', true)).rejects.toMatchObject({
      status: 404,
      code: 'ERR_NOT_FOUND',
    })
  })

  it('is refused while PENDING', async () => {
    setMockProfileStatus('PENDING')

    await expect(partnerTablesService.setTableVisibility('t1', true)).rejects.toMatchObject({
      status: 409,
      code: 'ERR_PROFILE_READ_ONLY',
    })
  })
})

describe('partnerTablesService.deleteTable', () => {
  it('soft-deletes the table and it leaves the grid', async () => {
    await expect(partnerTablesService.deleteTable('t4')).resolves.toEqual({
      tableId: 't4',
      deleted: true,
    })
    expect(mockTable('t4')).toBeUndefined()
    expect(mockTableCount()).toBe(3)
  })

  it('is refused with 409 ERR_TABLE_IN_USE while assigned to an upcoming interest table', async () => {
    markTableInUse('t1', 2)

    await expect(partnerTablesService.deleteTable('t1')).rejects.toMatchObject({
      status: 409,
      code: 'ERR_TABLE_IN_USE',
    })
    expect(mockTable('t1')).toBeDefined()
  })

  it('reports how many upcoming tables are holding it', async () => {
    markTableInUse('t1', 3)

    const error = await caught(partnerTablesService.deleteTable('t1'))

    expect(error.responseBody).toMatchObject({ error: { details: { upcomingTables: 3 } } })
  })

  it('becomes deletable once those interest tables complete or cancel (AC-05.3)', async () => {
    markTableInUse('t1', 1)
    await expect(partnerTablesService.deleteTable('t1')).rejects.toMatchObject({
      code: 'ERR_TABLE_IN_USE',
    })

    releaseTable('t1')

    await expect(partnerTablesService.deleteTable('t1')).resolves.toMatchObject({ deleted: true })
  })

  it('404s for an unknown table', async () => {
    await expect(partnerTablesService.deleteTable('t-nope')).rejects.toMatchObject({
      status: 404,
      code: 'ERR_NOT_FOUND',
    })
  })

  it('is refused while PENDING', async () => {
    setMockProfileStatus('PENDING')

    await expect(partnerTablesService.deleteTable('t1')).rejects.toMatchObject({
      status: 409,
      code: 'ERR_PROFILE_READ_ONLY',
    })
  })
})

describe('endpoint paths', () => {
  it('never carries a restaurant id — scope comes from the token', () => {
    expect(PARTNER_TABLES_ENDPOINTS.tables).toBe('/api/v1/partner/restaurant/tables')
    expect(PARTNER_TABLES_ENDPOINTS.tableById('t1')).toBe('/api/v1/partner/restaurant/tables/t1')
    expect(PARTNER_TABLES_ENDPOINTS.tableVisibility('t1')).toBe(
      '/api/v1/partner/restaurant/tables/t1/visibility',
    )
  })

  it('sends the Bearer token on the read', async () => {
    let authorization: string | null = null
    server.use(
      http.get(LIST, ({ request }) => {
        authorization = request.headers.get('Authorization')
        return HttpResponse.json({ success: true, data: { items: [] } })
      }),
    )

    await partnerTablesService.listTables()

    expect(authorization).toBe('Bearer access-1')
  })
})
