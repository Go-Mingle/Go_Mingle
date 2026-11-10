import { describe, it, expect } from 'vitest'
import { HttpError } from '../../api/httpClient'
import { getApiErrorMessage } from '../apiError'

describe('getApiErrorMessage', () => {
  it('returns the message from the response body when present', () => {
    const error = new HttpError(400, 'Bad Request', 'ERR_VALIDATION', 'ERR_VALIDATION')
    error.responseBody = { error: { code: 'ERR_VALIDATION', message: 'Email already in use' } }
    expect(getApiErrorMessage(error, 'fallback')).toBe('Email already in use')
  })

  it('returns the fallback when the response body carries no message', () => {
    const error = new HttpError(500, 'Internal Server Error', 'ERR_INTERNAL', 'ERR_INTERNAL')
    error.responseBody = { error: { code: 'ERR_INTERNAL' } }
    expect(getApiErrorMessage(error, 'fallback')).toBe('fallback')
  })

  it('returns the fallback when the response body is absent or null', () => {
    const noBody = new HttpError(503, 'Service Unavailable', 'ERR_SERVICE_UNAVAILABLE')
    expect(getApiErrorMessage(noBody, 'fallback')).toBe('fallback')

    const nullBody = new HttpError(503, 'Service Unavailable', 'ERR_SERVICE_UNAVAILABLE')
    nullBody.responseBody = null
    expect(getApiErrorMessage(nullBody, 'fallback')).toBe('fallback')
  })

  it('reads data.message when the wording arrives under data', () => {
    // J1's verify endpoint sends the specific "incorrect" vs "expired" copy here.
    const error = new HttpError(422, 'Unprocessable', 'ERR_VALIDATION', 'ERR_VALIDATION')
    error.responseBody = { data: { message: 'This code has expired. Request a new one.' } }
    expect(getApiErrorMessage(error, 'fallback')).toBe('This code has expired. Request a new one.')
  })

  it('reads a bare top-level message', () => {
    const error = new HttpError(400, 'Bad Request', 'Bad Request')
    error.responseBody = { message: 'top level' }
    expect(getApiErrorMessage(error, 'fallback')).toBe('top level')
  })

  /**
   * MET-1148. Where both are sent, the top-level `message` is the generic
   * catalogue string for the code and the detail carries the section-specific
   * copy the spec mandates. Preferring the top level would show the partner
   * strictly less than the backend sent.
   */
  it('prefers error.details.message over the generic error.message', () => {
    const error = new HttpError(422, 'Unprocessable', 'ERR_MEDIA_TYPE', 'ERR_MEDIA_TYPE')
    error.responseBody = {
      error: {
        code: 'ERR_MEDIA_TYPE',
        message: "This file type isn't supported for this section.",
        details: {
          contentType: 'application/pdf',
          message: 'Only PDF, DOCX, JPG or PNG documents are allowed.',
        },
      },
    }
    expect(getApiErrorMessage(error, 'fallback')).toBe(
      'Only PDF, DOCX, JPG or PNG documents are allowed.',
    )
  })

  /** Details without a message must not swallow the top-level wording. */
  it('falls through to error.message when details carries no message', () => {
    const error = new HttpError(409, 'Conflict', 'ERR_MENU_OPTION_IN_USE', 'ERR_MENU_OPTION_IN_USE')
    error.responseBody = {
      error: { message: 'This menu option is in use.', details: { upcomingTables: 2 } },
    }
    expect(getApiErrorMessage(error, 'fallback')).toBe('This menu option is in use.')
  })

  it('prefers error.message over data.message when both are present', () => {
    const error = new HttpError(422, 'Unprocessable', 'ERR_VALIDATION', 'ERR_VALIDATION')
    error.responseBody = {
      error: { message: 'canonical envelope' },
      data: { message: 'secondary' },
    }
    expect(getApiErrorMessage(error, 'fallback')).toBe('canonical envelope')
  })

  it('returns the fallback when the body carries no message anywhere', () => {
    const error = new HttpError(400, 'Bad Request', 'Bad Request')
    error.responseBody = { data: {}, error: {} }
    expect(getApiErrorMessage(error, 'fallback')).toBe('fallback')
  })

  /** A blank message renders as nothing, which is the bug MET-1256 is about. */
  it('returns the fallback when the only message present is blank', () => {
    const error = new HttpError(500, 'Internal Server Error', 'ERR_INTERNAL', 'ERR_INTERNAL')
    error.responseBody = { error: { code: 'ERR_INTERNAL', message: '   ' } }
    expect(getApiErrorMessage(error, 'fallback')).toBe('fallback')
  })

  it('returns the fallback for anything that is not an HttpError', () => {
    expect(getApiErrorMessage(new Error('boom'), 'fallback')).toBe('fallback')
    expect(getApiErrorMessage('boom', 'fallback')).toBe('fallback')
    expect(getApiErrorMessage(undefined, 'fallback')).toBe('fallback')
    expect(getApiErrorMessage(null, 'fallback')).toBe('fallback')
  })
})
