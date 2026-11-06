import { describe, it, expect } from 'vitest'
import { HttpError } from '../../../../../shared/api/httpClient'
import { isReviewNotFound, reviewsErrorFallbackKey } from '../errors'

function httpError(status: number, code: string): HttpError {
  return new HttpError(status, 'Error', code, code)
}

describe('reviewsErrorFallbackKey', () => {
  it('names the review for a 404', () => {
    expect(reviewsErrorFallbackKey(httpError(404, 'ERR_NOT_FOUND'))).toBe(
      'restaurants:partnerReviews.errors.notFound',
    )
  })

  it.each([
    ['a 500', httpError(500, 'ERR_INTERNAL')],
    ['a 503', httpError(503, 'ERR_SERVICE_UNAVAILABLE')],
    ['a body with no code', httpError(500, '')],
    ['an unrecognised code', httpError(418, 'ERR_TEAPOT')],
  ])('falls back to the generic message for %s', (_label, error) => {
    expect(reviewsErrorFallbackKey(error)).toBe('common:errors.genericError')
  })

  it.each([
    ['a network failure', new TypeError('Failed to fetch')],
    ['a plain Error', new Error('boom')],
    ['a string', 'nope'],
    ['null', null],
    ['undefined', undefined],
  ])('falls back to the generic message for %s', (_label, error) => {
    expect(reviewsErrorFallbackKey(error)).toBe('common:errors.genericError')
  })

  /**
   * Branching on the code, never the status. A 404 from some other cause would
   * still be "this review is gone" here, but a 401 must not be mapped at all —
   * SessionWatcher owns those and ends the session.
   */
  it('does not claim a 401 or 403 as its own', () => {
    expect(reviewsErrorFallbackKey(httpError(401, 'ERR_TOKEN_EXPIRED'))).toBe(
      'common:errors.genericError',
    )
    expect(reviewsErrorFallbackKey(httpError(403, 'ERR_ACCOUNT_SUSPENDED'))).toBe(
      'common:errors.genericError',
    )
  })
})

describe('isReviewNotFound', () => {
  /**
   * The detail endpoint returns the same 404 for a deleted review and another
   * restaurant's review, deliberately. Both mean "gone", so the caller closes the
   * modal and re-reads the list rather than showing an error panel.
   */
  it('recognises the 404', () => {
    expect(isReviewNotFound(httpError(404, 'ERR_NOT_FOUND'))).toBe(true)
  })

  it.each([
    ['a 500', httpError(500, 'ERR_INTERNAL')],
    ['a 503', httpError(503, 'ERR_SERVICE_UNAVAILABLE')],
    ['a validation error', httpError(422, 'ERR_VALIDATION')],
    ['a network failure', new TypeError('Failed to fetch')],
    ['null', null],
  ])('does not recognise %s', (_label, error) => {
    expect(isReviewNotFound(error)).toBe(false)
  })

  /** Keyed on the code, so a 404 carrying a different code is not swallowed. */
  it('ignores a 404 that carries another code', () => {
    expect(isReviewNotFound(httpError(404, 'ERR_SOMETHING_ELSE'))).toBe(false)
  })
})
