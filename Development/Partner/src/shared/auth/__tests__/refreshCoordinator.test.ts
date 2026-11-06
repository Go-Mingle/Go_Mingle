import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setAuthProvider } from '../authProvider'
import { AuthError } from '../authError'
import { refreshOnce, __resetRefreshCoordinator } from '../refreshCoordinator'
import { __resetCrossTabSession } from '../crossTabSession'
import { tokenStore } from '../tokenStore'
import type { PartnerAuthProvider } from '../types'

let refresh: ReturnType<typeof vi.fn>

/**
 * Restored by hand rather than with `vi.unstubAllGlobals()`, which would also
 * drop the `localStorage` stub `setupTests.ts` installs at module load — after
 * which `tokenStore` writes silently no-op and every later test in the file
 * misreads the store.
 */
const realNavigator = globalThis.navigator

/** Renews to `access-2` in the store, as the real Cognito adapter does. */
function provider(): void {
  refresh = vi.fn(() => {
    tokenStore.setAccessToken('access-2', Date.now() + 1000)
    return Promise.resolve('access-2')
  })
  setAuthProvider({
    signIn: vi.fn(),
    getAccessToken: () => tokenStore.getAccessToken(),
    refresh,
    signOut: vi.fn(),
    getIdentity: () => null,
  } as unknown as PartnerAuthProvider)
}

beforeEach(() => {
  provider()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 1 })
})

afterEach(() => {
  __resetRefreshCoordinator()
  __resetCrossTabSession()
  setAuthProvider(null)
  vi.stubGlobal('navigator', realNavigator)
})

describe('refreshOnce — single-flight within the tab (BR-04)', () => {
  it('exchanges once for N concurrent callers', async () => {
    const results = await Promise.all([
      refreshOnce('access-1'),
      refreshOnce('access-1'),
      refreshOnce('access-1'),
      refreshOnce('access-1'),
      refreshOnce('access-1'),
    ])

    expect(results).toEqual(Array(5).fill('access-2'))
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('allows a later refresh once the first settles', async () => {
    await refreshOnce('access-1')
    await refreshOnce('access-2')
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  /** A stuck in-flight promise would wedge every future renewal. */
  it('clears the in-flight slot after a failure', async () => {
    refresh.mockRejectedValueOnce(new AuthError('REFRESH_FAILED'))
    await expect(refreshOnce('access-1')).rejects.toBeInstanceOf(AuthError)

    provider()
    await expect(refreshOnce('access-1')).resolves.toBe('access-2')
  })
})

describe('refreshOnce — cross-tab coordination (BR-09, AC-02.3)', () => {
  /** Serialises callers the way navigator.locks does. */
  function installLock(): ReturnType<typeof vi.fn> {
    const request = vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn())
    vi.stubGlobal('navigator', { ...navigator, locks: { request } })
    return request
  }

  it('takes the browser-wide lock before exchanging', async () => {
    const request = installLock()
    await refreshOnce('access-1')

    expect(request).toHaveBeenCalledOnce()
    expect(request.mock.calls[0][0]).toBe('gomingle-partner-refresh')
    expect(refresh).toHaveBeenCalledOnce()
  })

  /**
   * The reason the lock alone is insufficient. The waiting tab acquires it
   * *after* the other has already rotated the refresh token; exchanging again
   * would be the second call BR-04 warns can invalidate the session.
   */
  it('adopts a token another tab minted instead of exchanging again', async () => {
    installLock()
    // Another tab renewed while this one queued for the lock.
    tokenStore.setAccessToken('access-from-other-tab', Date.now() + 1000)

    await expect(refreshOnce('access-1')).resolves.toBe('access-from-other-tab')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('still exchanges when the stored token is the one that was rejected', async () => {
    installLock()
    await expect(refreshOnce('access-1')).resolves.toBe('access-2')
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('exchanges when the caller supplies no stale token to compare', async () => {
    installLock()
    await expect(refreshOnce()).resolves.toBe('access-2')
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('exchanges when the store has been cleared', async () => {
    installLock()
    tokenStore.clear()
    await expect(refreshOnce('access-1')).resolves.toBe('access-2')
    expect(refresh).toHaveBeenCalledOnce()
  })

  /** Without Web Locks the in-tab guarantee must still hold. */
  it('falls back to in-tab single-flight when Web Locks is absent', async () => {
    const results = await Promise.all([refreshOnce('access-1'), refreshOnce('access-1')])
    expect(results).toEqual(['access-2', 'access-2'])
    expect(refresh).toHaveBeenCalledOnce()
  })
})
