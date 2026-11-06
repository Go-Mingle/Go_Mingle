import { describe, it, expect } from 'vitest'
import { HttpError } from '../../../../../shared/api/httpClient'
import { upcomingTablesCount } from '../../../../../shared/utils/apiError'
import {
  isTableInUse,
  isTableMissing,
  isTableNameDuplicate,
  tablesErrorFallbackKey,
} from '../errors'

function httpError(status: number, code: string, details: Record<string, unknown> = {}): HttpError {
  const error = new HttpError(status, 'Error', code, code)
  error.responseBody = { success: false, error: { code, message: `${code} happened`, details } }
  return error
}

describe('tablesErrorFallbackKey', () => {
  it.each([
    // All three 409s, which is exactly why this branches on the code and not the
    // status — they are three unrelated situations sharing one HTTP code.
    ['ERR_PROFILE_READ_ONLY', 409, 'restaurants:partnerTables.errors.readOnly'],
    ['ERR_TABLE_NAME_DUPLICATE', 409, 'restaurants:partnerTables.errors.nameDuplicate'],
    ['ERR_TABLE_IN_USE', 409, 'restaurants:partnerTables.errors.inUse'],
    ['ERR_NOT_FOUND', 404, 'restaurants:partnerTables.errors.notFound'],
    ['ERR_VALIDATION', 422, 'restaurants:partnerTables.errors.validation'],
  ])('maps %s to its own copy', (code, status, key) => {
    expect(tablesErrorFallbackKey(httpError(status, code))).toBe(key)
  })

  it.each([
    ['ERR_INTERNAL', 500],
    ['ERR_SERVICE_UNAVAILABLE', 503],
    // A malformed tableId is rejected by the UUID pipe before any handler runs.
    // The UI only ever sends ids from the list, so generic copy is right.
    ['', 400],
  ])('falls back to the generic message for %s', (code, status) => {
    expect(tablesErrorFallbackKey(httpError(status, code))).toBe('common:errors.genericError')
  })

  it.each([
    ['a network failure', new TypeError('Failed to fetch')],
    ['a plain Error', new Error('boom')],
    ['a string', 'boom'],
    ['undefined', undefined],
    ['null', null],
  ])('falls back to the generic message for %s', (_label, cause) => {
    expect(tablesErrorFallbackKey(cause)).toBe('common:errors.genericError')
  })
})

describe('isTableNameDuplicate', () => {
  it('is true for the duplicate-name conflict', () => {
    expect(
      isTableNameDuplicate(httpError(409, 'ERR_TABLE_NAME_DUPLICATE', { field: 'name' })),
    ).toBe(true)
  })

  it('is false for the other two 409s, which share the status but nothing else', () => {
    expect(isTableNameDuplicate(httpError(409, 'ERR_PROFILE_READ_ONLY'))).toBe(false)
    expect(isTableNameDuplicate(httpError(409, 'ERR_TABLE_IN_USE'))).toBe(false)
  })

  it('is false for anything that is not an HttpError', () => {
    expect(isTableNameDuplicate(new Error('offline'))).toBe(false)
  })
})

describe('isTableInUse', () => {
  it('is true for the delete guard', () => {
    expect(isTableInUse(httpError(409, 'ERR_TABLE_IN_USE', { upcomingTables: 2 }))).toBe(true)
  })

  it('is false for the duplicate-name conflict', () => {
    expect(isTableInUse(httpError(409, 'ERR_TABLE_NAME_DUPLICATE'))).toBe(false)
  })

  it('is false for anything that is not an HttpError', () => {
    expect(isTableInUse('boom')).toBe(false)
  })
})

describe('isTableMissing', () => {
  it("is true for a 404 — including another restaurant's table, by design", () => {
    expect(isTableMissing(httpError(404, 'ERR_NOT_FOUND'))).toBe(true)
  })

  it('is false for other failures', () => {
    expect(isTableMissing(httpError(500, 'ERR_INTERNAL'))).toBe(false)
    expect(isTableMissing(undefined)).toBe(false)
  })
})

describe('upcomingTablesCount — as J6E consumes it', () => {
  it('reads the count the delete guard reports', () => {
    expect(upcomingTablesCount(httpError(409, 'ERR_TABLE_IN_USE', { upcomingTables: 3 }))).toBe(3)
  })

  it.each([
    ['the detail is absent', {}],
    ['the count is zero', { upcomingTables: 0 }],
    ['the count is not a number', { upcomingTables: 'two' }],
    ['the count is not finite', { upcomingTables: Number.POSITIVE_INFINITY }],
  ])('returns 0 when %s, so the dialog can drop the number', (_label, details) => {
    expect(upcomingTablesCount(httpError(409, 'ERR_TABLE_IN_USE', details))).toBe(0)
  })

  it('floors a fractional count', () => {
    expect(upcomingTablesCount(httpError(409, 'ERR_TABLE_IN_USE', { upcomingTables: 2.7 }))).toBe(2)
  })

  it('returns 0 for anything that is not an HttpError', () => {
    expect(upcomingTablesCount(new Error('offline'))).toBe(0)
  })
})
