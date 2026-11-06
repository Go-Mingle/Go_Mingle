import { describe, it, expect } from 'vitest'
import { HttpError } from '../httpClient'
import { partnerRetryDelay, partnerRetryPolicy, shouldRetryPartnerQuery } from '../retryPolicy'

const unavailable = () =>
  new HttpError(503, 'Service Unavailable', 'ERR_SERVICE_UNAVAILABLE', 'ERR_SERVICE_UNAVAILABLE')

describe('shouldRetryPartnerQuery', () => {
  it('retries a 503 up to three times', () => {
    expect(shouldRetryPartnerQuery(0, unavailable())).toBe(true)
    expect(shouldRetryPartnerQuery(1, unavailable())).toBe(true)
    expect(shouldRetryPartnerQuery(2, unavailable())).toBe(true)
  })

  it('stops after the third failure', () => {
    expect(shouldRetryPartnerQuery(3, unavailable())).toBe(false)
  })

  it.each([401, 403, 404, 500])('does not retry a %i', (status) => {
    expect(shouldRetryPartnerQuery(0, new HttpError(status, 'x', 'x'))).toBe(false)
  })

  it('does not retry a non-HttpError', () => {
    expect(shouldRetryPartnerQuery(0, new Error('network'))).toBe(false)
    expect(shouldRetryPartnerQuery(0, undefined)).toBe(false)
  })
})

describe('partnerRetryDelay', () => {
  it('backs off exponentially', () => {
    expect(partnerRetryDelay(0)).toBe(500)
    expect(partnerRetryDelay(1)).toBe(1000)
    expect(partnerRetryDelay(2)).toBe(2000)
  })

  it('caps at eight seconds', () => {
    expect(partnerRetryDelay(10)).toBe(8000)
  })
})

describe('partnerRetryPolicy', () => {
  it('bundles both functions for spreading into useQuery', () => {
    expect(partnerRetryPolicy.retry).toBe(shouldRetryPartnerQuery)
    expect(partnerRetryPolicy.retryDelay).toBe(partnerRetryDelay)
  })
})
