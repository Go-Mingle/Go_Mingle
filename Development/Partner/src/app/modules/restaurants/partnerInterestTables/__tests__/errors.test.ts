import { describe, it, expect } from 'vitest'
import { HttpError } from '../../../../../shared/api/httpClient'
import {
  blockedState,
  interestTablesErrorFallbackKey,
  isBookingNotCancellable,
  isInterestTablesReadOnly,
  isInviteNotCancellable,
  isNotFound,
  isProminglerBooking,
} from '../errors'

const KEY = 'restaurants:partnerInterestTables.errors'

function httpError(status: number, code: string, details: Record<string, unknown> = {}): HttpError {
  const error = new HttpError(status, 'Error', code, code)
  error.responseBody = { success: false, error: { code, message: `${code} happened`, details } }
  return error
}

describe('interestTablesErrorFallbackKey', () => {
  it.each([
    ['ERR_BOOKING_NOT_CANCELLABLE', 409, `${KEY}.bookingNotCancellable`],
    ['ERR_PROMINGLER_BOOKING_NOT_CANCELLABLE', 409, `${KEY}.prominglerBooking`],
    ['ERR_INVITE_NOT_CANCELLABLE', 409, `${KEY}.inviteNotCancellable`],
    ['ERR_PROFILE_READ_ONLY', 409, `${KEY}.readOnly`],
    ['ERR_NOT_FOUND', 404, `${KEY}.notFound`],
  ])('maps %s to its own copy', (code, status, key) => {
    expect(interestTablesErrorFallbackKey(httpError(status, code))).toBe(key)
  })

  it('maps the spec-documented short Promingler code to the same copy', () => {
    // The spec says ERR_PROMINGLER_BOOKING; the backend ships the longer name.
    // Both resolve identically so a rename in either direction cannot regress us.
    expect(interestTablesErrorFallbackKey(httpError(409, 'ERR_PROMINGLER_BOOKING'))).toBe(
      `${KEY}.prominglerBooking`,
    )
  })

  it('distinguishes all four 409s, which is why this branches on code not status', () => {
    const keys = [
      'ERR_BOOKING_NOT_CANCELLABLE',
      'ERR_PROMINGLER_BOOKING_NOT_CANCELLABLE',
      'ERR_INVITE_NOT_CANCELLABLE',
      'ERR_PROFILE_READ_ONLY',
    ].map((code) => interestTablesErrorFallbackKey(httpError(409, code)))

    expect(new Set(keys).size).toBe(4)
  })

  it.each([
    ['ERR_INTERNAL', 500],
    ['ERR_SERVICE_UNAVAILABLE', 503],
    ['', 400],
  ])('falls back to the generic message for %s', (code, status) => {
    expect(interestTablesErrorFallbackKey(httpError(status, code))).toBe(
      'common:errors.genericError',
    )
  })

  it.each([
    ['a network failure', new TypeError('Failed to fetch')],
    ['a plain Error', new Error('boom')],
    ['a string', 'boom'],
    ['undefined', undefined],
    ['null', null],
  ])('falls back to the generic message for %s', (_label, cause) => {
    expect(interestTablesErrorFallbackKey(cause)).toBe('common:errors.genericError')
  })
})

describe('isBookingNotCancellable', () => {
  it('is true for a terminal or charge-retry booking', () => {
    expect(isBookingNotCancellable(httpError(409, 'ERR_BOOKING_NOT_CANCELLABLE'))).toBe(true)
  })

  it('is false for the other 409s on this surface', () => {
    expect(isBookingNotCancellable(httpError(409, 'ERR_PROMINGLER_BOOKING_NOT_CANCELLABLE'))).toBe(
      false,
    )
    expect(isBookingNotCancellable(httpError(409, 'ERR_PROFILE_READ_ONLY'))).toBe(false)
  })

  it('is false for anything that is not an HttpError', () => {
    expect(isBookingNotCancellable(new Error('offline'))).toBe(false)
  })
})

describe('isProminglerBooking', () => {
  it('matches the shipped long code', () => {
    expect(isProminglerBooking(httpError(409, 'ERR_PROMINGLER_BOOKING_NOT_CANCELLABLE'))).toBe(true)
  })

  it('matches the spec-documented short code', () => {
    expect(isProminglerBooking(httpError(409, 'ERR_PROMINGLER_BOOKING'))).toBe(true)
  })

  it('is false for the generic not-cancellable code', () => {
    expect(isProminglerBooking(httpError(409, 'ERR_BOOKING_NOT_CANCELLABLE'))).toBe(false)
  })

  it('is false for anything that is not an HttpError', () => {
    expect(isProminglerBooking('boom')).toBe(false)
  })
})

describe('isInviteNotCancellable', () => {
  it('is true when the invite is Table Booked or already Cancelled', () => {
    expect(isInviteNotCancellable(httpError(409, 'ERR_INVITE_NOT_CANCELLABLE'))).toBe(true)
  })

  it('is false for a booking refusal', () => {
    expect(isInviteNotCancellable(httpError(409, 'ERR_BOOKING_NOT_CANCELLABLE'))).toBe(false)
  })

  it('is false for anything that is not an HttpError', () => {
    expect(isInviteNotCancellable(undefined)).toBe(false)
  })
})

describe('isInterestTablesReadOnly', () => {
  it('is true when the restaurant is not ACTIVE', () => {
    // Reachable even though the UI hides both × buttons outside ACTIVE — the profile
    // can change state in another tab.
    expect(isInterestTablesReadOnly(httpError(409, 'ERR_PROFILE_READ_ONLY'))).toBe(true)
  })

  it('is false for the cancellation refusals', () => {
    expect(isInterestTablesReadOnly(httpError(409, 'ERR_INVITE_NOT_CANCELLABLE'))).toBe(false)
  })

  it('is false for anything that is not an HttpError', () => {
    expect(isInterestTablesReadOnly(null)).toBe(false)
  })
})

describe('isNotFound', () => {
  it("is true for a Draft table, another restaurant's data, or an unknown id", () => {
    // All three are deliberately indistinguishable (BR-03/BR-04).
    expect(isNotFound(httpError(404, 'ERR_NOT_FOUND'))).toBe(true)
  })

  it('is false for other failures', () => {
    expect(isNotFound(httpError(500, 'ERR_INTERNAL'))).toBe(false)
    expect(isNotFound(undefined)).toBe(false)
  })
})

describe('blockedState', () => {
  it("reads a booking's details.status", () => {
    expect(
      blockedState(httpError(409, 'ERR_BOOKING_NOT_CANCELLABLE', { status: 'COMPLETED' })),
    ).toBe('COMPLETED')
  })

  it("reads an invite's details.inviteStatus", () => {
    expect(
      blockedState(httpError(409, 'ERR_INVITE_NOT_CANCELLABLE', { inviteStatus: 'TABLE_BOOKED' })),
    ).toBe('TABLE_BOOKED')
  })

  it.each([
    ['the detail is absent', {}],
    ['the value is blank', { status: '   ' }],
    ['the value is not a string', { status: 42 }],
  ])('returns null when %s, so the copy can drop the state', (_label, details) => {
    expect(blockedState(httpError(409, 'ERR_BOOKING_NOT_CANCELLABLE', details))).toBeNull()
  })

  it('returns null for anything that is not an HttpError', () => {
    expect(blockedState(new Error('offline'))).toBeNull()
  })

  it('returns null when the response carries no body', () => {
    const error = new HttpError(
      409,
      'Conflict',
      'ERR_BOOKING_NOT_CANCELLABLE',
      'ERR_BOOKING_NOT_CANCELLABLE',
    )
    expect(blockedState(error)).toBeNull()
  })
})
