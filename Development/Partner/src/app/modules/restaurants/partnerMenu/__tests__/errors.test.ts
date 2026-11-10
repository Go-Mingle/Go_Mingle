import { describe, it, expect } from 'vitest'
import { HttpError } from '../../../../../shared/api/httpClient'
import {
  isMenuOptionInUse,
  isMenuPdfMissing,
  menuErrorFallbackKey,
  upcomingTablesCount,
} from '../errors'

function httpError(status: number, code: string, details?: Record<string, unknown>): HttpError {
  const error = new HttpError(status, 'Error', code, code)
  if (details) {
    error.responseBody = { success: false, error: { code, message: 'nope', details } }
  }
  return error
}

const KEY = 'restaurants:partnerMenu.errors'

describe('menuErrorFallbackKey', () => {
  /**
   * Branching is on the code, never the status: on this tab 409 alone covers the
   * profile being under review *and* the combo being committed to an upcoming
   * interest table, and the two need entirely different copy.
   */
  it.each([
    ['ERR_PROFILE_READ_ONLY', 409, `${KEY}.readOnly`],
    ['ERR_MENU_OPTION_IN_USE', 409, `${KEY}.inUse`],
    ['ERR_MEDIA_TOO_LARGE', 413, `${KEY}.tooLarge`],
    ['ERR_MEDIA_TYPE', 422, `${KEY}.badType`],
    ['ERR_NOT_FOUND', 404, `${KEY}.notFound`],
    ['ERR_VALIDATION', 422, `${KEY}.validation`],
  ])('maps %s to its own copy', (code, status, key) => {
    expect(menuErrorFallbackKey(httpError(status, code))).toBe(key)
  })

  /** Two of the six are J6B's, reused: the menu PDF shares its size and type rules. */
  it('distinguishes the two 409s', () => {
    expect(menuErrorFallbackKey(httpError(409, 'ERR_PROFILE_READ_ONLY'))).not.toBe(
      menuErrorFallbackKey(httpError(409, 'ERR_MENU_OPTION_IN_USE')),
    )
  })

  it.each([
    ['an unrecognised code', httpError(500, 'ERR_INTERNAL')],
    ['a body with no code', httpError(500, '')],
    ['a plain Error', new Error('boom')],
    ['a thrown string', 'boom'],
    ['null', null],
    ['undefined', undefined],
  ])('falls back to the generic key for %s', (_label, thrown) => {
    expect(menuErrorFallbackKey(thrown)).toBe('common:errors.genericError')
  })
})

describe('isMenuOptionInUse', () => {
  /** The signal to offer hiding rather than report a failure (BR-09). */
  it('recognises the delete guard', () => {
    expect(isMenuOptionInUse(httpError(409, 'ERR_MENU_OPTION_IN_USE'))).toBe(true)
  })

  it('rejects the other 409 on this tab', () => {
    expect(isMenuOptionInUse(httpError(409, 'ERR_PROFILE_READ_ONLY'))).toBe(false)
  })

  it('rejects a non-HttpError', () => {
    expect(isMenuOptionInUse(new Error('offline'))).toBe(false)
  })
})

describe('upcomingTablesCount', () => {
  it('reads the count the guard reports', () => {
    expect(
      upcomingTablesCount(httpError(409, 'ERR_MENU_OPTION_IN_USE', { upcomingTables: 2 })),
    ).toBe(2)
  })

  it('floors a fractional count rather than rendering "1.5 tables"', () => {
    expect(
      upcomingTablesCount(httpError(409, 'ERR_MENU_OPTION_IN_USE', { upcomingTables: 2.7 })),
    ).toBe(2)
  })

  /**
   * Zero means "say it without a number" — the dialog has copy for that, and
   * "used by 0 upcoming interest tables" would be worse than saying nothing.
   */
  it.each([
    ['the details are absent', httpError(409, 'ERR_MENU_OPTION_IN_USE')],
    ['the count is missing', httpError(409, 'ERR_MENU_OPTION_IN_USE', {})],
    ['the count is zero', httpError(409, 'ERR_MENU_OPTION_IN_USE', { upcomingTables: 0 })],
    ['the count is negative', httpError(409, 'ERR_MENU_OPTION_IN_USE', { upcomingTables: -1 })],
    ['the count is a string', httpError(409, 'ERR_MENU_OPTION_IN_USE', { upcomingTables: 'two' })],
    ['the count is NaN', httpError(409, 'ERR_MENU_OPTION_IN_USE', { upcomingTables: Number.NaN })],
    ['it is not an HttpError', new Error('boom')],
  ])('returns 0 when %s', (_label, thrown) => {
    expect(upcomingTablesCount(thrown)).toBe(0)
  })
})

describe('isMenuPdfMissing', () => {
  /** Reachable by a double-click or another tab deleting first. */
  it('recognises a delete that found nothing', () => {
    expect(isMenuPdfMissing(httpError(404, 'ERR_NOT_FOUND'))).toBe(true)
  })

  it('rejects a different failure', () => {
    expect(isMenuPdfMissing(httpError(409, 'ERR_PROFILE_READ_ONLY'))).toBe(false)
    expect(isMenuPdfMissing(null)).toBe(false)
  })
})
