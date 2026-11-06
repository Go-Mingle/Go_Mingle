import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  onSessionLost,
  emitSessionLost,
  isSessionLost,
  resetSessionLostLatch,
  __clearSessionListeners,
} from '../sessionEvents'
import { tokenStore } from '../tokenStore'

afterEach(() => {
  __clearSessionListeners()
})

describe('sessionEvents', () => {
  it('delivers the reason to every subscriber', () => {
    const a = vi.fn()
    const b = vi.fn()
    onSessionLost(a)
    onSessionLost(b)

    emitSessionLost('ACCOUNT_SUSPENDED')

    expect(a).toHaveBeenCalledExactlyOnceWith('ACCOUNT_SUSPENDED')
    expect(b).toHaveBeenCalledExactlyOnceWith('ACCOUNT_SUSPENDED')
  })

  it('stops delivering after unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = onSessionLost(listener)

    unsubscribe()
    emitSessionLost('TOKEN_INVALID')

    expect(listener).not.toHaveBeenCalled()
  })

  it('registers a listener once even if subscribed twice (StrictMode double-effect)', () => {
    const listener = vi.fn()
    onSessionLost(listener)
    onSessionLost(listener)

    emitSessionLost('REFRESH_FAILED')

    expect(listener).toHaveBeenCalledOnce()
  })

  it('is a no-op when nobody is listening', () => {
    expect(() => {
      emitSessionLost('NO_PARTNER_ACCOUNT')
    }).not.toThrow()
  })

  it('clears every listener on reset', () => {
    const listener = vi.fn()
    onSessionLost(listener)

    __clearSessionListeners()
    emitSessionLost('TOKEN_INVALID')

    expect(listener).not.toHaveBeenCalled()
  })
})

/**
 * FE1 AC-02.2 — N requests failing together are one event to the user. Without
 * the latch they would produce N toasts and N redirects.
 */
describe('sessionEvents — the one-shot latch', () => {
  it('delivers only the first of several terminations', () => {
    const listener = vi.fn()
    onSessionLost(listener)

    emitSessionLost('REFRESH_FAILED')
    emitSessionLost('REFRESH_FAILED')
    emitSessionLost('TOKEN_INVALID')

    expect(listener).toHaveBeenCalledExactlyOnceWith('REFRESH_FAILED')
  })

  it('keeps the reason of the first termination, not the last', () => {
    const listener = vi.fn()
    onSessionLost(listener)

    emitSessionLost('ACCOUNT_SUSPENDED')
    emitSessionLost('TOKEN_INVALID')

    // The suspension message is the one worth showing (AC-04.2).
    expect(listener).toHaveBeenCalledExactlyOnceWith('ACCOUNT_SUSPENDED')
  })

  it('reports whether the session has been lost', () => {
    expect(isSessionLost()).toBe(false)
    emitSessionLost('TOKEN_INVALID')
    expect(isSessionLost()).toBe(true)
  })

  it('emits again once the latch is re-armed', () => {
    const listener = vi.fn()
    onSessionLost(listener)

    emitSessionLost('TOKEN_INVALID')
    resetSessionLostLatch()
    emitSessionLost('REFRESH_FAILED')

    expect(listener).toHaveBeenCalledTimes(2)
  })

  /** The reset is wired to `setTokens`, so no journey has to remember it. */
  it('is re-armed by storing a new session', () => {
    const listener = vi.fn()
    onSessionLost(listener)
    emitSessionLost('TOKEN_INVALID')

    tokenStore.setTokens({ accessToken: 'access-9', refreshToken: 'refresh-9', expiresAt: 1 })
    expect(isSessionLost()).toBe(false)

    emitSessionLost('REFRESH_FAILED')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  /** Renewal replaces only the access token; it is not a new session. */
  it('is not re-armed by a silent renewal', () => {
    emitSessionLost('TOKEN_INVALID')
    tokenStore.setAccessToken('access-2', Date.now() + 1000)
    expect(isSessionLost()).toBe(true)
  })

  it('re-arms on the test reset helper', () => {
    emitSessionLost('TOKEN_INVALID')
    __clearSessionListeners()
    expect(isSessionLost()).toBe(false)
  })
})
