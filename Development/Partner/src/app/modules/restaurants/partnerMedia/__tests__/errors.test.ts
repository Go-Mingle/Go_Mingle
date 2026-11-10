import { describe, it, expect } from 'vitest'
import { HttpError } from '../../../../../shared/api/httpClient'
import {
  isCoverReassignRequired,
  isMediaLimitReached,
  isMediaReadOnly,
  mediaErrorFallbackKey,
} from '../errors'
import type { MediaKind } from '../types'

function httpError(status: number, code: string): HttpError {
  return new HttpError(status, 'Error', code, code)
}

const KINDS: MediaKind[] = ['document', 'photo', 'video']

describe('mediaErrorFallbackKey', () => {
  /**
   * 409 alone covers four different situations here — read-only while PENDING,
   * the count limit, the cover-reassign guard and a wrong-state write — so the
   * code decides the copy, never the status.
   */
  it('distinguishes the three 409s from each other', () => {
    expect(mediaErrorFallbackKey(httpError(409, 'ERR_PROFILE_READ_ONLY'), 'photo')).toBe(
      'restaurants:partnerMedia.errors.readOnly',
    )
    expect(mediaErrorFallbackKey(httpError(409, 'ERR_MEDIA_LIMIT_REACHED'), 'photo')).toBe(
      'restaurants:partnerMedia.errors.limitReached.photo',
    )
    expect(mediaErrorFallbackKey(httpError(409, 'ERR_COVER_PHOTO_REASSIGN'), 'photo')).toBe(
      'restaurants:partnerMedia.errors.coverReassign',
    )
  })

  /** With three limits on one screen, the copy has to name which one was hit. */
  it.each(KINDS)('names the kind in the limit message for %s', (kind) => {
    expect(mediaErrorFallbackKey(httpError(409, 'ERR_MEDIA_LIMIT_REACHED'), kind)).toBe(
      `restaurants:partnerMedia.errors.limitReached.${kind}`,
    )
  })

  it.each(KINDS)('names the kind in the size message for %s', (kind) => {
    expect(mediaErrorFallbackKey(httpError(413, 'ERR_MEDIA_TOO_LARGE'), kind)).toBe(
      `restaurants:partnerMedia.errors.tooLarge.${kind}`,
    )
  })

  it.each(KINDS)('names the kind in the type message for %s', (kind) => {
    expect(mediaErrorFallbackKey(httpError(422, 'ERR_MEDIA_TYPE'), kind)).toBe(
      `restaurants:partnerMedia.errors.badType.${kind}`,
    )
  })

  it.each(KINDS)('names the kind in the not-found message for %s', (kind) => {
    expect(mediaErrorFallbackKey(httpError(404, 'ERR_NOT_FOUND'), kind)).toBe(
      `restaurants:partnerMedia.errors.notFound.${kind}`,
    )
  })

  it('maps the video provider failure to its own copy', () => {
    expect(mediaErrorFallbackKey(httpError(502, 'ERR_VIDEO_PROVIDER'), 'video')).toBe(
      'restaurants:partnerMedia.errors.videoProvider',
    )
  })

  it('maps a bad sort or search param to the validation copy', () => {
    expect(mediaErrorFallbackKey(httpError(422, 'ERR_VALIDATION'), 'document')).toBe(
      'restaurants:partnerMedia.errors.validation',
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
    expect(mediaErrorFallbackKey(thrown, 'photo')).toBe('common:errors.genericError')
  })
})

describe('the code predicates', () => {
  /**
   * Each has to recognise only its own 409 — mistaking one for another would
   * show the partner the wrong recovery.
   */
  it.each([
    ['isCoverReassignRequired', isCoverReassignRequired, 'ERR_COVER_PHOTO_REASSIGN'],
    ['isMediaReadOnly', isMediaReadOnly, 'ERR_PROFILE_READ_ONLY'],
    ['isMediaLimitReached', isMediaLimitReached, 'ERR_MEDIA_LIMIT_REACHED'],
  ] as const)('%s matches only its own code', (_label, predicate, code) => {
    expect(predicate(httpError(409, code))).toBe(true)

    const others = [
      'ERR_COVER_PHOTO_REASSIGN',
      'ERR_PROFILE_READ_ONLY',
      'ERR_MEDIA_LIMIT_REACHED',
    ].filter((other) => other !== code)

    others.forEach((other) => {
      expect(predicate(httpError(409, other))).toBe(false)
    })
  })

  it.each([
    ['isCoverReassignRequired', isCoverReassignRequired],
    ['isMediaReadOnly', isMediaReadOnly],
    ['isMediaLimitReached', isMediaLimitReached],
  ] as const)('%s rejects a non-HTTP failure', (_label, predicate) => {
    expect(predicate(new Error('offline'))).toBe(false)
    expect(predicate(null)).toBe(false)
  })
})
