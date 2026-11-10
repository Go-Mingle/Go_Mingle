import { describe, it, expect } from 'vitest'
import { HttpError } from '../../../../shared/api/httpClient'
import { isDateRangeError, isNotificationNotFound, notificationsErrorFallbackKey } from '../errors'

function httpError(status: number, code: string): HttpError {
  return new HttpError(status, 'Error', code, code)
}

describe('notificationsErrorFallbackKey', () => {
  /** 400 covers both date-range cases, and they need different copy — hence code, not status. */
  it('distinguishes the two date-range failures', () => {
    expect(notificationsErrorFallbackKey(httpError(400, 'ERR_DATE_RANGE_INCOMPLETE'))).toBe(
      'notifications:errors.dateRangeIncomplete',
    )
    expect(notificationsErrorFallbackKey(httpError(400, 'ERR_DATE_RANGE_INVALID'))).toBe(
      'notifications:errors.dateRangeInvalid',
    )
  })

  it('names validation and not-found', () => {
    expect(notificationsErrorFallbackKey(httpError(422, 'ERR_VALIDATION'))).toBe(
      'notifications:errors.validation',
    )
    expect(notificationsErrorFallbackKey(httpError(404, 'ERR_NOT_FOUND'))).toBe(
      'notifications:errors.notFound',
    )
  })

  it.each([
    ['a 500', httpError(500, 'ERR_INTERNAL')],
    ['a 503', httpError(503, 'ERR_SERVICE_UNAVAILABLE')],
    ['a body with no code', httpError(500, '')],
    ['an unrecognised code', httpError(418, 'ERR_TEAPOT')],
    ['a network failure', new TypeError('Failed to fetch')],
    ['a plain Error', new Error('boom')],
    ['null', null],
    ['undefined', undefined],
  ])('falls back to the generic message for %s', (_label, error) => {
    expect(notificationsErrorFallbackKey(error)).toBe('common:errors.genericError')
  })

  /** SessionWatcher owns these; this module must not claim them. */
  it('does not claim a 401 or 403', () => {
    expect(notificationsErrorFallbackKey(httpError(401, 'ERR_TOKEN_EXPIRED'))).toBe(
      'common:errors.genericError',
    )
    expect(notificationsErrorFallbackKey(httpError(403, 'ERR_ACCOUNT_SUSPENDED'))).toBe(
      'common:errors.genericError',
    )
  })
})

describe('isNotificationNotFound', () => {
  it('recognises the 404', () => {
    expect(isNotificationNotFound(httpError(404, 'ERR_NOT_FOUND'))).toBe(true)
  })

  it.each([
    ['a 500', httpError(500, 'ERR_INTERNAL')],
    ['a validation error', httpError(422, 'ERR_VALIDATION')],
    ['a network failure', new TypeError('Failed to fetch')],
    ['null', null],
  ])('does not recognise %s', (_label, error) => {
    expect(isNotificationNotFound(error)).toBe(false)
  })

  it('ignores a 404 carrying another code', () => {
    expect(isNotificationNotFound(httpError(404, 'ERR_SOMETHING_ELSE'))).toBe(false)
  })
})

describe('isDateRangeError', () => {
  it.each(['ERR_DATE_RANGE_INCOMPLETE', 'ERR_DATE_RANGE_INVALID'])('recognises %s', (code) => {
    expect(isDateRangeError(httpError(400, code))).toBe(true)
  })

  it.each([
    ['a generic validation error', httpError(422, 'ERR_VALIDATION')],
    ['a 500', httpError(500, 'ERR_INTERNAL')],
    ['a 404', httpError(404, 'ERR_NOT_FOUND')],
    ['a network failure', new TypeError('Failed to fetch')],
    ['null', null],
  ])('does not recognise %s', (_label, error) => {
    expect(isDateRangeError(error)).toBe(false)
  })

  /** Keyed on the code, so a 400 from some other cause is not mistaken for a range error. */
  it('ignores an unrelated 400', () => {
    expect(isDateRangeError(httpError(400, 'ERR_SOMETHING_ELSE'))).toBe(false)
  })
})
