import { describe, it, expect } from 'vitest'
import { HttpError } from '../../../../../shared/api/httpClient'
import { profileErrorFallbackKey, isProfileReadOnly, readSubmitBlockers } from '../errors'
import type { SubmitBlockedDetails } from '../types'

function httpError(status: number, code: string, body?: unknown): HttpError {
  const error = new HttpError(status, 'Error', code, code)
  error.responseBody = body
  return error
}

function submitError(details: unknown): HttpError {
  return httpError(422, 'ERR_VALIDATION', { error: { details } })
}

describe('profileErrorFallbackKey', () => {
  /**
   * One status maps to several situations here — 409 alone is read-only, the
   * last-contact guard and a wrong-state submit — so the code decides, never
   * the status.
   */
  it.each([
    ['ERR_PROFILE_READ_ONLY', 409, 'restaurants:profile.errors.readOnly'],
    ['ERR_LAST_CONTACT', 409, 'restaurants:profile.errors.lastContact'],
    ['ERR_INVALID_STATE', 409, 'restaurants:profile.errors.invalidState'],
    ['ERR_COVER_PHOTO_REQUIRED', 422, 'restaurants:profile.errors.coverPhotoRequired'],
    ['ERR_PAYMENT_SEAM', 503, 'restaurants:profile.errors.paymentSeam'],
    ['ERR_NOT_FOUND', 404, 'restaurants:profile.errors.contactNotFound'],
    ['ERR_VALIDATION', 422, 'restaurants:profile.errors.validation'],
  ])('maps %s to its own copy', (code, status, key) => {
    expect(profileErrorFallbackKey(httpError(status, code))).toBe(key)
  })

  it('falls back to the generic key for an unrecognised code', () => {
    expect(profileErrorFallbackKey(httpError(500, 'ERR_INTERNAL'))).toBe(
      'common:errors.genericError',
    )
  })

  it('falls back for a body that carried no code at all', () => {
    expect(profileErrorFallbackKey(httpError(500, ''))).toBe('common:errors.genericError')
  })

  it.each([
    ['a plain Error', new Error('boom')],
    ['a thrown string', 'boom'],
    ['null', null],
    ['undefined', undefined],
  ])('falls back for %s', (_label, thrown) => {
    expect(profileErrorFallbackKey(thrown)).toBe('common:errors.genericError')
  })
})

describe('isProfileReadOnly', () => {
  it('recognises the under-review refusal (BR-03)', () => {
    expect(isProfileReadOnly(httpError(409, 'ERR_PROFILE_READ_ONLY'))).toBe(true)
  })

  /** A different 409 must not be mistaken for read-only. */
  it('rejects another 409', () => {
    expect(isProfileReadOnly(httpError(409, 'ERR_LAST_CONTACT'))).toBe(false)
  })

  it('rejects a non-HTTP failure', () => {
    expect(isProfileReadOnly(new Error('offline'))).toBe(false)
  })
})

describe('readSubmitBlockers', () => {
  it('returns all three blockers from the one response', () => {
    const details: SubmitBlockedDetails = {
      missingFields: ['cuisine', 'openingHours'],
      needsPayout: true,
      needsCoverPhoto: true,
    }
    expect(readSubmitBlockers(submitError(details))).toEqual(details)
  })

  it.each([
    [
      'only missing fields',
      { missingFields: ['cuisine'] },
      { missingFields: ['cuisine'], needsPayout: false, needsCoverPhoto: false },
    ],
    [
      'only Safepay',
      { needsPayout: true },
      { missingFields: [], needsPayout: true, needsCoverPhoto: false },
    ],
    [
      'only the cover photo',
      { needsCoverPhoto: true },
      { missingFields: [], needsPayout: false, needsCoverPhoto: true },
    ],
  ])('normalises %s, defaulting the absent keys', (_label, details, expected) => {
    expect(readSubmitBlockers(submitError(details))).toEqual(expected)
  })

  it('coerces truthy non-booleans the backend might send', () => {
    expect(readSubmitBlockers(submitError({ needsPayout: 1, needsCoverPhoto: 0 }))).toEqual({
      missingFields: [],
      needsPayout: true,
      needsCoverPhoto: false,
    })
  })

  it('ignores a non-array missingFields rather than crashing on .length', () => {
    expect(
      readSubmitBlockers(submitError({ missingFields: 'cuisine', needsPayout: true })),
    ).toEqual({
      missingFields: [],
      needsPayout: true,
      needsCoverPhoto: false,
    })
  })

  /** A 422 that is not the submission gate is somebody else's error to report. */
  it.each([
    ['an empty blocker set', {}],
    ['an empty missingFields array', { missingFields: [] }],
    ['all blockers false', { missingFields: [], needsPayout: false, needsCoverPhoto: false }],
  ])('returns null for %s', (_label, details) => {
    expect(readSubmitBlockers(submitError(details))).toBeNull()
  })

  it('returns null when details is absent', () => {
    expect(readSubmitBlockers(httpError(422, 'ERR_VALIDATION', { error: {} }))).toBeNull()
  })

  it('returns null when there is no body', () => {
    expect(readSubmitBlockers(httpError(422, 'ERR_VALIDATION'))).toBeNull()
  })

  it('returns null for a 422 whose code is something else', () => {
    const error = httpError(422, 'ERR_COVER_PHOTO_REQUIRED', {
      error: { details: { needsCoverPhoto: true } },
    })
    expect(readSubmitBlockers(error)).toBeNull()
  })

  it('returns null for a non-HTTP failure', () => {
    expect(readSubmitBlockers(new Error('offline'))).toBeNull()
  })
})
