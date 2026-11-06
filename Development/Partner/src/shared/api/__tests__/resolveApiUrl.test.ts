import { describe, it, expect } from 'vitest'
import { resolveApiUrl } from '../httpClient'

const PATH = '/api/v1/partner/signup/start'

describe('resolveApiUrl', () => {
  /**
   * The dev-server case. The Vite proxy forwards `/api` to the backend, so the
   * request must stay same-origin and relative.
   */
  it.each([
    ['an empty base', ''],
    ['whitespace only', '   '],
  ])('returns the path unchanged for %s', (_label, base) => {
    expect(resolveApiUrl(PATH, base)).toBe(PATH)
  })

  /** The deployed case: a static bundle has no proxy to lean on. */
  it('prefixes the API origin', () => {
    expect(resolveApiUrl(PATH, 'https://devapi.gomingle.com')).toBe(
      'https://devapi.gomingle.com/api/v1/partner/signup/start',
    )
  })

  /** The value is hand-entered into a CI variable, so tolerate a stray slash. */
  it.each([
    ['one trailing slash', 'https://devapi.gomingle.com/'],
    ['several', 'https://devapi.gomingle.com///'],
    ['surrounding whitespace', '  https://devapi.gomingle.com  '],
  ])('normalises %s rather than producing a double slash', (_label, base) => {
    expect(resolveApiUrl(PATH, base)).toBe(
      'https://devapi.gomingle.com/api/v1/partner/signup/start',
    )
  })

  it('keeps a base that carries its own path prefix', () => {
    expect(resolveApiUrl(PATH, 'https://gateway.gomingle.com/partner')).toBe(
      'https://gateway.gomingle.com/partner/api/v1/partner/signup/start',
    )
  })

  it('preserves the query string', () => {
    expect(resolveApiUrl('/api/v1/partner/finances?page=2', 'https://devapi.gomingle.com')).toBe(
      'https://devapi.gomingle.com/api/v1/partner/finances?page=2',
    )
  })

  it('works for every environment host', () => {
    expect(resolveApiUrl(PATH, 'https://qaapi.gomingle.com')).toBe(
      'https://qaapi.gomingle.com/api/v1/partner/signup/start',
    )
  })
})
