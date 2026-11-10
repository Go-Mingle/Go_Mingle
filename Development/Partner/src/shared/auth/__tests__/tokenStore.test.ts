import { describe, it, expect, vi, afterEach } from 'vitest'
import { tokenStore } from '../tokenStore'

const identity = { id: 'u1', email: 'laiba@aurelia.pk', fullName: 'Laiba Hashmi' }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('tokenStore', () => {
  it('round-trips tokens, expiry and identity', () => {
    tokenStore.setTokens({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresAt: 1_800_000,
      identity,
    })

    expect(tokenStore.getAccessToken()).toBe('access-1')
    expect(tokenStore.getRefreshToken()).toBe('refresh-1')
    expect(tokenStore.getExpiresAt()).toBe(1_800_000)
    expect(tokenStore.getIdentity()).toEqual(identity)
    expect(tokenStore.hasSession()).toBe(true)
  })

  it('writes the access token to the key the HTTP client reads', () => {
    tokenStore.setTokens({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresAt: 1,
    })
    expect(localStorage.getItem('auth-token')).toBe('access-1')
  })

  it('stores no identity when none is supplied', () => {
    tokenStore.setTokens({ accessToken: 'a', refreshToken: 'r', expiresAt: 1 })
    expect(tokenStore.getIdentity()).toBeNull()
  })

  it('replaces only the access token on renewal', () => {
    tokenStore.setTokens({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresAt: 1,
      identity,
    })
    tokenStore.setAccessToken('access-2', 2)

    expect(tokenStore.getAccessToken()).toBe('access-2')
    expect(tokenStore.getExpiresAt()).toBe(2)
    expect(tokenStore.getRefreshToken()).toBe('refresh-1')
    expect(tokenStore.getIdentity()).toEqual(identity)
  })

  it('reports an empty session and null reads before anything is stored', () => {
    expect(tokenStore.getAccessToken()).toBeNull()
    expect(tokenStore.getRefreshToken()).toBeNull()
    expect(tokenStore.getExpiresAt()).toBeNull()
    expect(tokenStore.getIdentity()).toBeNull()
    expect(tokenStore.hasSession()).toBe(false)
  })

  it('clears everything', () => {
    tokenStore.setTokens({ accessToken: 'a', refreshToken: 'r', expiresAt: 1, identity })
    tokenStore.clear()

    expect(tokenStore.getAccessToken()).toBeNull()
    expect(tokenStore.getRefreshToken()).toBeNull()
    expect(tokenStore.getExpiresAt()).toBeNull()
    expect(tokenStore.getIdentity()).toBeNull()
    expect(tokenStore.hasSession()).toBe(false)
  })

  it('treats an unparseable expiry as absent', () => {
    localStorage.setItem('auth-token-expiry', 'not-a-number')
    expect(tokenStore.getExpiresAt()).toBeNull()
  })

  it('treats a corrupt identity as absent rather than throwing', () => {
    localStorage.setItem('auth-identity', '{ not json')
    expect(() => tokenStore.getIdentity()).not.toThrow()
    expect(tokenStore.getIdentity()).toBeNull()
  })

  it('survives a localStorage that throws on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(tokenStore.getAccessToken()).toBeNull()
    expect(tokenStore.hasSession()).toBe(false)
  })

  it('survives a localStorage that throws on write and remove', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect(() =>
      tokenStore.setTokens({ accessToken: 'a', refreshToken: 'r', expiresAt: 1, identity }),
    ).not.toThrow()
    expect(() => {
      tokenStore.setAccessToken('a', 1)
    }).not.toThrow()
    expect(() => {
      tokenStore.clear()
    }).not.toThrow()
  })
})

describe('tokenStore — refuses to persist a non-token', () => {
  it('rejects a missing access token instead of storing "undefined"', () => {
    // localStorage.setItem(k, undefined) stores the STRING "undefined", which is
    // truthy — so this used to look like a real session and every request went
    // out as `Bearer undefined`, drawing a 401 that read like an expired session.
    expect(() =>
      tokenStore.setTokens({
        accessToken: undefined as unknown as string,
        refreshToken: 'r',
        expiresAt: 1,
      }),
    ).toThrow(/refusing to store/i)
    expect(tokenStore.hasSession()).toBe(false)
  })

  it('rejects a missing refresh token', () => {
    expect(() =>
      tokenStore.setTokens({
        accessToken: 'a',
        refreshToken: undefined as unknown as string,
        expiresAt: 1,
      }),
    ).toThrow(/refusing to store/i)
  })

  it('rejects an empty access token', () => {
    expect(() =>
      tokenStore.setTokens({ accessToken: '', refreshToken: 'r', expiresAt: 1 }),
    ).toThrow(/refusing to store/i)
  })

  it('rejects an empty renewal token', () => {
    expect(() => {
      tokenStore.setAccessToken('', 1)
    }).toThrow(/refusing to store/i)
  })

  it('treats an already-corrupt stored value as absent', () => {
    // Defensive: storage written by an older build could still hold these.
    localStorage.setItem('auth-token', 'undefined')
    expect(tokenStore.getAccessToken()).toBeNull()
    expect(tokenStore.hasSession()).toBe(false)

    localStorage.setItem('auth-token', 'null')
    expect(tokenStore.getAccessToken()).toBeNull()
  })
})
