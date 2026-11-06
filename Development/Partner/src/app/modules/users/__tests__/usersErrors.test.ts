import { describe, it, expect } from 'vitest'
import { HttpError } from '../../../../shared/api/httpClient'
import { isForbiddenPrimary, usersErrorFallbackKey } from '../usersErrors'

function httpError(status: number, code: string): HttpError {
  return new HttpError(status, 'Error', code, code)
}

describe('usersErrorFallbackKey', () => {
  it('maps a duplicate email to its own copy', () => {
    expect(usersErrorFallbackKey(httpError(409, 'ERR_DUPLICATE_EMAIL'))).toBe(
      'users:errors.duplicateEmail',
    )
  })

  it('maps the primary-user guard to its own copy', () => {
    expect(usersErrorFallbackKey(httpError(403, 'ERR_FORBIDDEN_PRIMARY'))).toBe(
      'users:errors.forbiddenPrimary',
    )
  })

  it('maps a 404 to the stale-list copy', () => {
    expect(usersErrorFallbackKey(httpError(404, 'ERR_NOT_FOUND'))).toBe('users:errors.notFound')
  })

  it('maps a 422 to the field-check copy', () => {
    expect(usersErrorFallbackKey(httpError(422, 'ERR_VALIDATION'))).toBe('users:errors.validation')
  })

  it('falls back to the generic copy for an unmapped code', () => {
    expect(usersErrorFallbackKey(httpError(500, 'ERR_INTERNAL'))).toBe('common:errors.genericError')
  })

  it('falls back to the generic copy for a non-HttpError', () => {
    expect(usersErrorFallbackKey(new Error('offline'))).toBe('common:errors.genericError')
  })
})

describe('isForbiddenPrimary', () => {
  /**
   * The distinction that matters: on these routes a 403 is either the caller's
   * own suspension — which ends the session — or the primary-user guard, which
   * must not. Both are 403, so only the code can tell them apart.
   */
  it('is true for the primary-user guard', () => {
    expect(isForbiddenPrimary(httpError(403, 'ERR_FORBIDDEN_PRIMARY'))).toBe(true)
  })

  it('is false for a suspension, which shares the same status', () => {
    expect(isForbiddenPrimary(httpError(403, 'ERR_ACCOUNT_SUSPENDED'))).toBe(false)
  })

  it('is false for a non-HttpError', () => {
    expect(isForbiddenPrimary(new Error('offline'))).toBe(false)
  })
})
