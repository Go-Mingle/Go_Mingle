import { describe, it, expect } from 'vitest'
import { scrubTokens, REDACTED } from '../scrubTokens'

/** Structurally a JWS: three base64url segments, header starting `eyJ`. */
const JWT =
  'eyJhbGciOiJSUzI1NiIsImtpZCI6ImFiYyJ9.eyJzdWIiOiIxMjM0IiwiZXhwIjo5OTk5fQ.c2lnbmF0dXJlLWhlcmU'

describe('scrubTokens — strings', () => {
  it('redacts a bare JWT', () => {
    expect(scrubTokens(JWT)).toBe(REDACTED)
  })

  /** The common shape: a token embedded in a larger message. */
  it('redacts a JWT inside a surrounding string', () => {
    expect(scrubTokens(`Authorization: Bearer ${JWT} failed`)).toBe(
      `Authorization: Bearer ${REDACTED} failed`,
    )
  })

  it('redacts every occurrence, not just the first', () => {
    const scrubbed = scrubTokens(`${JWT} and ${JWT}`) as string
    expect(scrubbed).toBe(`${REDACTED} and ${REDACTED}`)
    expect(scrubbed).not.toContain('eyJ')
  })

  it('leaves ordinary text alone', () => {
    expect(scrubTokens('Contacts unavailable.')).toBe('Contacts unavailable.')
  })

  /** Must not maul unrelated text that merely starts with the same letters. */
  it('leaves a non-token word beginning with eyJ alone', () => {
    expect(scrubTokens('eyJustKidding')).toBe('eyJustKidding')
  })
})

describe('scrubTokens — objects', () => {
  it.each([
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'idToken',
    'id_token',
    'authorization',
    'password',
    'session',
  ])('redacts the %s key whatever its value looks like', (key) => {
    const scrubbed = scrubTokens({ [key]: 'not-even-a-jwt' }) as Record<string, unknown>
    expect(scrubbed[key]).toBe(REDACTED)
  })

  it('matches secret keys case-insensitively', () => {
    expect(scrubTokens({ AccessToken: JWT })).toEqual({ AccessToken: REDACTED })
  })

  it('keeps non-secret fields intact', () => {
    expect(scrubTokens({ email: 'partner@aurelia.pk', status: 'ACTIVE' })).toEqual({
      email: 'partner@aurelia.pk',
      status: 'ACTIVE',
    })
  })

  /** The real shape at risk: the signup verify envelope. */
  it('scrubs a nested session envelope', () => {
    const body = {
      success: true,
      data: {
        partnerUser: { id: 'pu-1', email: 'partner@aurelia.pk' },
        session: { accessToken: JWT, refreshToken: 'r-1', expiresIn: 3600 },
      },
    }
    expect(scrubTokens(body)).toEqual({
      success: true,
      data: {
        partnerUser: { id: 'pu-1', email: 'partner@aurelia.pk' },
        session: REDACTED,
      },
    })
  })

  it('scrubs tokens inside arrays, keeping the surrounding text', () => {
    expect(scrubTokens({ headers: [`Bearer ${JWT}`, 'Accept: application/json'] })).toEqual({
      headers: [`Bearer ${REDACTED}`, 'Accept: application/json'],
    })
  })

  it('does not mutate the input', () => {
    const body = { accessToken: JWT }
    scrubTokens(body)
    expect(body.accessToken).toBe(JWT)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['a boolean', true],
  ])('passes %s through untouched', (_label, value) => {
    expect(scrubTokens(value)).toBe(value)
  })

  /**
   * A scrubber that throws would take the error report down with it, so a
   * cycle is tolerated rather than fatal.
   */
  it('survives a cyclic object', () => {
    const cyclic: Record<string, unknown> = { accessToken: JWT }
    cyclic.self = cyclic
    expect(() => scrubTokens(cyclic)).not.toThrow()
    expect((scrubTokens(cyclic) as Record<string, unknown>).accessToken).toBe(REDACTED)
  })

  /** BR-11 end to end: nothing token-shaped survives anywhere in the tree. */
  it('leaves no eyJ anywhere in a deeply nested payload', () => {
    const payload = {
      level1: { level2: { level3: { note: `token ${JWT}`, list: [{ idToken: JWT }] } } },
    }
    expect(JSON.stringify(scrubTokens(payload))).not.toContain('eyJ')
  })
})
