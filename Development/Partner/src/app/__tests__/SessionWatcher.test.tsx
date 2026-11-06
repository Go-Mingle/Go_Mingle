import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders, makeStore } from '../../test-utils/renderWithProviders'
import {
  emitSessionLost,
  __clearSessionListeners,
  type SessionLostReason,
} from '../../shared/auth/sessionEvents'
import { setAuthProvider } from '../../shared/auth/authProvider'
import type { PartnerAuthProvider } from '../../shared/auth/types'
import { tokenStore } from '../../shared/auth/tokenStore'
import {
  getSessionRestaurantId,
  setSessionRestaurantId,
} from '../modules/session/restaurantIdCache'
import { SessionWatcher, reasonToMessageKey } from '../SessionWatcher'

/**
 * The channel itself is covered by `crossTabSession.test.ts`; what matters here
 * is the wiring — that a local termination is broadcast, that a remote one
 * tears down, and that a remote one is *not* echoed back.
 */
const posted: unknown[] = []
const remoteListeners = new Set<(reason: SessionLostReason) => void>()

vi.mock('../../shared/auth/crossTabSession', () => ({
  broadcastSessionLost: (reason: SessionLostReason) => {
    posted.push({ type: 'session-lost', reason })
  },
  onRemoteSessionLost: (listener: (reason: SessionLostReason) => void) => {
    remoteListeners.add(listener)
    return () => remoteListeners.delete(listener)
  },
}))

/** Simulates the message another tab would have sent. */
function deliverFromOtherTab(reason: SessionLostReason): void {
  remoteListeners.forEach((listener) => listener(reason))
}

const AUTHENTICATED_STATE = {
  auth: {
    user: {
      id: 'u1',
      name: 'Hira Mansoor',
      email: 'partner@gomingle.com',
      role: 'x',
      initials: 'HM',
    },
    isAuthenticated: true,
    accessTokenExpiry: Date.now() + 1000,
    refreshTokenExpiry: Date.now() + 2000,
  },
}

function renderWatcher() {
  const store = makeStore(AUTHENTICATED_STATE)
  renderWithProviders(
    <Routes>
      <Route element={<SessionWatcher />}>
        <Route path="/" element={<div>PROTECTED</div>} />
        <Route path="/login" element={<div>LOGIN</div>} />
      </Route>
    </Routes>,
    { route: '/', store },
  )
  return store
}

beforeEach(() => {
  posted.length = 0
  remoteListeners.clear()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 1 })
  setSessionRestaurantId('rest1')
})

afterEach(() => {
  __clearSessionListeners()
  setSessionRestaurantId(null)
})

describe('reasonToMessageKey', () => {
  it.each([
    ['ACCOUNT_SUSPENDED', 'errors.accountSuspended'],
    ['NO_PARTNER_ACCOUNT', 'errors.accountNotFound'],
    ['TOKEN_INVALID', 'errors.sessionExpired'],
    ['REFRESH_FAILED', 'errors.sessionExpired'],
  ] as const)('maps %s to %s', (reason, key) => {
    expect(reasonToMessageKey(reason)).toBe(key)
  })
})

describe('SessionWatcher', () => {
  it('renders the routed screen while the session is healthy', () => {
    renderWatcher()
    expect(screen.getByText('PROTECTED')).toBeInTheDocument()
  })

  it.each([
    ['ACCOUNT_SUSPENDED', 'Your account has been suspended. Please contact support.'],
    ['NO_PARTNER_ACCOUNT', 'Account not found. Please contact support.'],
    ['TOKEN_INVALID', 'Your session has expired. Please sign in again.'],
    ['REFRESH_FAILED', 'Your session has expired. Please sign in again.'],
  ] as [SessionLostReason, string][])(
    'toasts and redirects to login on %s',
    async (reason, copy) => {
      renderWatcher()

      act(() => {
        emitSessionLost(reason)
      })

      // Both assertions matter: the toast must still be mounted *after* the
      // redirect, which is only true because the watcher sits above the router.
      expect(await screen.findByText('LOGIN')).toBeInTheDocument()
      expect(await screen.findByText(copy)).toBeInTheDocument()
    },
  )

  it('clears the token, the redux session and the cached restaurant id', async () => {
    const store = renderWatcher()

    act(() => {
      emitSessionLost('ACCOUNT_SUSPENDED')
    })
    await screen.findByText('LOGIN')

    expect(tokenStore.hasSession()).toBe(false)
    expect(getSessionRestaurantId()).toBeNull()
    const state = store.getState() as { auth: { isAuthenticated: boolean; user: unknown } }
    expect(state.auth.isAuthenticated).toBe(false)
    expect(state.auth.user).toBeNull()
  })

  it('handles a second event without throwing', async () => {
    renderWatcher()

    act(() => {
      emitSessionLost('TOKEN_INVALID')
      emitSessionLost('TOKEN_INVALID')
    })

    expect(await screen.findByText('LOGIN')).toBeInTheDocument()
  })

  /** AC-02.2 — one transition, not one per failed request. */
  it('shows a single toast for several concurrent terminations', async () => {
    renderWatcher()

    act(() => {
      emitSessionLost('REFRESH_FAILED')
      emitSessionLost('REFRESH_FAILED')
      emitSessionLost('REFRESH_FAILED')
    })

    await screen.findByText('LOGIN')
    expect(screen.getAllByText('Your session has expired. Please sign in again.')).toHaveLength(1)
  })

  /**
   * AC-03.5 — termination must not call Cognito `signOut()`/`GlobalSignOut`.
   * The refresh token is already invalid on every path that gets here, so the
   * call is redundant and can itself fail.
   */
  it('never revokes at Cognito on the termination path', async () => {
    const signOut = vi.fn()
    setAuthProvider({
      signIn: vi.fn(),
      getAccessToken: () => null,
      refresh: vi.fn(),
      signOut,
      getIdentity: () => null,
    } as unknown as PartnerAuthProvider)

    renderWatcher()
    act(() => {
      emitSessionLost('REFRESH_FAILED')
    })
    await screen.findByText('LOGIN')

    expect(signOut).not.toHaveBeenCalled()
    setAuthProvider(null)
  })
})

/** BR-09 — a session that ended in one tab has ended in all of them. */
describe('SessionWatcher — cross-tab termination', () => {
  it('tells the other tabs when this one terminates', async () => {
    renderWatcher()

    act(() => {
      emitSessionLost('ACCOUNT_SUSPENDED')
    })
    await screen.findByText('LOGIN')

    expect(posted).toEqual([{ type: 'session-lost', reason: 'ACCOUNT_SUSPENDED' }])
  })

  it('tears down when another tab terminates', async () => {
    const store = renderWatcher()

    act(() => {
      deliverFromOtherTab('ACCOUNT_SUSPENDED')
    })

    expect(await screen.findByText('LOGIN')).toBeInTheDocument()
    expect(
      await screen.findByText('Your account has been suspended. Please contact support.'),
    ).toBeInTheDocument()
    expect(tokenStore.hasSession()).toBe(false)
    const state = store.getState() as { auth: { isAuthenticated: boolean } }
    expect(state.auth.isAuthenticated).toBe(false)
  })

  /** Re-broadcasting would bounce the message between tabs indefinitely. */
  it('does not re-broadcast a termination it received', async () => {
    renderWatcher()

    act(() => {
      deliverFromOtherTab('TOKEN_INVALID')
    })
    await screen.findByText('LOGIN')

    expect(posted).toEqual([])
  })
})
