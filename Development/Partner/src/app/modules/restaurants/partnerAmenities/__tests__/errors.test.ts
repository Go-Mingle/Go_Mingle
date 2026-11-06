import { describe, it, expect } from 'vitest'
import { HttpError } from '../../../../../shared/api/httpClient'
import { amenityErrorFallbackKey, isAmenitiesReadOnly, isAmenityRetired } from '../errors'

function httpError(status: number, code: string): HttpError {
  return new HttpError(status, 'Error', code, code)
}

describe('amenityErrorFallbackKey', () => {
  /**
   * Branching is on the code, never the status: J6C's 404 means something
   * specific — the amenity was retired from the catalogue since the list loaded —
   * and needs its own copy, not a generic failure message.
   */
  it.each([
    ['ERR_PROFILE_READ_ONLY', 409, 'restaurants:partnerAmenities.errors.readOnly'],
    ['ERR_NOT_FOUND', 404, 'restaurants:partnerAmenities.errors.notFound'],
    ['ERR_VALIDATION', 422, 'restaurants:partnerAmenities.errors.validation'],
  ])('maps %s to its own copy', (code, status, key) => {
    expect(amenityErrorFallbackKey(httpError(status, code))).toBe(key)
  })

  it.each([
    ['an unrecognised code', httpError(500, 'ERR_INTERNAL')],
    ['a body with no code', httpError(500, '')],
    ['a plain Error', new Error('boom')],
    ['a thrown string', 'boom'],
    ['null', null],
    ['undefined', undefined],
  ])('falls back to the generic key for %s', (_label, thrown) => {
    expect(amenityErrorFallbackKey(thrown)).toBe('common:errors.genericError')
  })
})

describe('isAmenityRetired', () => {
  /** The signal to refetch rather than merely roll the toggle back. */
  it('recognises the retired-amenity 404', () => {
    expect(isAmenityRetired(httpError(404, 'ERR_NOT_FOUND'))).toBe(true)
  })

  it('rejects a different failure', () => {
    expect(isAmenityRetired(httpError(409, 'ERR_PROFILE_READ_ONLY'))).toBe(false)
    expect(isAmenityRetired(new Error('offline'))).toBe(false)
  })
})

describe('isAmenitiesReadOnly', () => {
  it('recognises the under-review refusal (BR-07)', () => {
    expect(isAmenitiesReadOnly(httpError(409, 'ERR_PROFILE_READ_ONLY'))).toBe(true)
  })

  it('rejects a different failure', () => {
    expect(isAmenitiesReadOnly(httpError(404, 'ERR_NOT_FOUND'))).toBe(false)
    expect(isAmenitiesReadOnly(null)).toBe(false)
  })
})
