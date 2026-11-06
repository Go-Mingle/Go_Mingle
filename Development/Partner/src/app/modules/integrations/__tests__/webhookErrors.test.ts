import { describe, it, expect } from 'vitest'
import { HttpError } from '../../../../shared/api/httpClient'
import { webhookErrorFallbackKey } from '../webhookErrors'

function httpError(status: number, code: string): HttpError {
  return new HttpError(status, 'Error', code, code)
}

describe('webhookErrorFallbackKey', () => {
  it('maps the J4 precondition to its own copy', () => {
    expect(webhookErrorFallbackKey(httpError(409, 'ERR_NOT_CONFIGURED'))).toBe(
      'integrations:errors.notConfigured',
    )
  })

  it('maps a 422 to the field-check copy', () => {
    expect(webhookErrorFallbackKey(httpError(422, 'ERR_VALIDATION'))).toBe(
      'integrations:errors.validation',
    )
  })

  it('falls back to the generic copy for an unmapped code', () => {
    expect(webhookErrorFallbackKey(httpError(500, 'ERR_INTERNAL'))).toBe(
      'common:errors.genericError',
    )
  })

  it('falls back to the generic copy for a non-HttpError', () => {
    expect(webhookErrorFallbackKey(new Error('offline'))).toBe('common:errors.genericError')
  })

  /**
   * The 403 case is why this keys on the code rather than the status: a
   * suspension ends the session inside httpClient, while ERR_NOT_CONFIGURED is
   * a precondition that must leave it alone. Neither is reachable by status
   * alone, so a status-based branch here would conflate them.
   */
  it('does not treat a suspension as a webhook-specific failure', () => {
    expect(webhookErrorFallbackKey(httpError(403, 'ERR_ACCOUNT_SUSPENDED'))).toBe(
      'common:errors.genericError',
    )
  })
})
