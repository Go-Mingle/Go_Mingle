import { describe, it, expect } from 'vitest'
import { HttpError } from '../../api/httpClient'
import { getApiErrorMessage } from '../apiError'

describe('getApiErrorMessage', () => {
  it('returns the message from the response body when present', () => {
    const error = new HttpError(400, 'Bad Request', 'Bad Request')
    error.responseBody = { error: { message: 'Email already in use' } }
    expect(getApiErrorMessage(error, 'fallback')).toBe('Email already in use')
  })

  it('returns the fallback when the response body has no message', () => {
    const error = new HttpError(500, 'Internal Server Error', 'Internal Server Error')
    error.responseBody = { error: {} }
    expect(getApiErrorMessage(error, 'fallback')).toBe('fallback')
  })

  // A-04 — the API answers the Cognito email-squatting case with a generic 500
  // telling the operator to retry, which can never succeed. A mapped code must
  // therefore win over the server-supplied text.
  it('prefers the mapped message for a known error code over the server message', () => {
    const error = new HttpError(500, 'Internal Server Error', 'boom', 'ERR_USER_CREATION_FAILED')
    error.responseBody = {
      error: { message: 'We could not create the account. Please try again.' },
    }
    const result = getApiErrorMessage(error, 'fallback')
    expect(result).toMatch(/already registered with the identity provider/i)
    expect(result).not.toMatch(/please try again/i)
  })

  it('maps the other known error codes', () => {
    const cases: [string, RegExp][] = [
      ['ERR_EMAIL_IN_USE', /account with this email already exists/i],
      ['ERR_SELF_MODIFICATION', /edit profile/i],
      ['ERR_LAST_SUPER_ADMIN', /last active super admin/i],
      ['ERR_SERVICE_UNAVAILABLE', /temporarily unavailable/i],
      ['ERR_ROLE_NOT_FOUND', /no longer exists/i],
    ]
    for (const [code, expected] of cases) {
      const error = new HttpError(409, 'Conflict', 'x', code)
      expect(getApiErrorMessage(error, 'fallback')).toMatch(expected)
    }
  })

  // Regression guard: the mapper is strictly additive. Unmapped codes must keep
  // echoing the server message, which 59 existing call sites rely on.
  it('falls back to the server message for an unmapped error code', () => {
    const error = new HttpError(400, 'Bad Request', 'x', 'ERR_SOMETHING_UNMAPPED')
    error.responseBody = { error: { message: 'Server said this' } }
    expect(getApiErrorMessage(error, 'fallback')).toBe('Server said this')
  })

  it('falls back to the caller fallback for an unmapped code with no server message', () => {
    const error = new HttpError(400, 'Bad Request', 'x', 'ERR_SOMETHING_UNMAPPED')
    expect(getApiErrorMessage(error, 'fallback')).toBe('fallback')
  })

  it('returns the fallback when the error is not an HttpError', () => {
    expect(getApiErrorMessage(new Error('boom'), 'fallback')).toBe('fallback')
    expect(getApiErrorMessage('boom', 'fallback')).toBe('fallback')
    expect(getApiErrorMessage(undefined, 'fallback')).toBe('fallback')
  })
})
