import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  authSlice,
  loginAction,
  logoutAction,
  updateUserAction,
  expireSessionAction,
  setPermissionsUnavailableAction,
} from '../shared/store/authSlice'

const { reducer } = authSlice

const mockUser = {
  id: 'user-1',
  name: 'Super Admin',
  email: 'admin@gomingle.com',
  role: 'Super Admin',
  permissions: [],
  fullAccess: true,
  initials: 'SA',
}

const emptyState = {
  user: null,
  isAuthenticated: false,
  accessTokenExpiry: null,
  refreshTokenExpiry: null,
  permissionsUnavailable: false,
}

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  })
})

/**
 * The slice reads localStorage at module load to restore a session across a page
 * reload — including the hard redirect FE1 termination performs — and, since
 * MET-1286, across a second tab opened on the same browser. Those branches only
 * run on import, so each case re-imports the module with storage already
 * populated.
 */
describe('authSlice — session restored at module load', () => {
  const liveExpiry = () =>
    JSON.stringify({ access: Date.now() + 1000, refresh: Date.now() + 100_000 })

  async function importSliceWith(stored: Record<string, string>) {
    vi.resetModules()
    const backing: Record<string, string> = { ...stored }
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => backing[k] ?? null,
      setItem: (k: string, v: string) => {
        backing[k] = v
      },
      removeItem: (k: string) => {
        delete backing[k]
      },
    })
    const mod = await import('../shared/store/authSlice')
    return { state: mod.authSlice.reducer(undefined, { type: '@@INIT' }), backing }
  }

  it('restores the user when the refresh window is still open', async () => {
    const { state } = await importSliceWith({
      'auth-token': 'access-token',
      'auth-user': JSON.stringify(mockUser),
      'auth-expiry': liveExpiry(),
    })

    expect(state.isAuthenticated).toBe(true)
    expect(state.user).toEqual(mockUser)
  })

  /**
   * MET-1286 — a second tab shares localStorage but has its own sessionStorage.
   * Storing the session per-tab meant this case booted unauthenticated and
   * AuthGuard bounced it to /login while the first tab stayed signed in.
   */
  it('restores the session in a tab that has no sessionStorage of its own', async () => {
    const perTab: Record<string, string> = {}
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => perTab[k] ?? null,
      setItem: (k: string, v: string) => {
        perTab[k] = v
      },
      removeItem: (k: string) => {
        delete perTab[k]
      },
    })

    const { state } = await importSliceWith({
      'auth-token': 'access-token',
      'auth-user': JSON.stringify(mockUser),
      'auth-expiry': liveExpiry(),
    })

    expect(state.isAuthenticated).toBe(true)
    expect(state.user).toEqual(mockUser)
  })

  /**
   * US-004 AC-007 — the tokens are the session. A profile that outlived them
   * must not restore, or the tab renders as signed in and 401s on every call.
   */
  it('does not restore a profile whose access token is gone', async () => {
    const { state, backing } = await importSliceWith({
      'auth-user': JSON.stringify(mockUser),
      'auth-expiry': liveExpiry(),
    })

    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
    expect(backing['auth-user']).toBeUndefined()
    expect(backing['auth-expiry']).toBeUndefined()
  })

  it('discards a stored session whose refresh window has closed', async () => {
    const { state, backing } = await importSliceWith({
      'auth-token': 'access-token',
      'auth-user': JSON.stringify(mockUser),
      'auth-expiry': JSON.stringify({ access: Date.now() - 100_000, refresh: Date.now() - 1000 }),
    })

    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
    // The stale entries are cleaned up rather than left to be re-read.
    expect(backing['auth-user']).toBeUndefined()
    expect(backing['auth-expiry']).toBeUndefined()
  })

  it('discards a stored user with no expiry record at all', async () => {
    const { state } = await importSliceWith({
      'auth-token': 'access-token',
      'auth-user': JSON.stringify(mockUser),
    })

    expect(state.isAuthenticated).toBe(false)
    expect(state.accessTokenExpiry).toBeNull()
  })
})

describe('authSlice', () => {
  it('has correct initial state when no stored user', () => {
    const state = reducer(undefined, { type: '@@INIT' })
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
  })

  it('sets user and isAuthenticated on loginAction', () => {
    const state = reducer(emptyState, loginAction(mockUser))
    expect(state.user).toEqual(mockUser)
    expect(state.isAuthenticated).toBe(true)
    expect(state.accessTokenExpiry).not.toBeNull()
    expect(state.refreshTokenExpiry).not.toBeNull()
  })

  it('persists user to localStorage on login', () => {
    reducer(emptyState, loginAction(mockUser))
    expect(localStorage.setItem).toHaveBeenCalledWith('auth-user', JSON.stringify(mockUser))
  })

  it('clears user and isAuthenticated on logoutAction', () => {
    const loggedInState = {
      user: mockUser,
      isAuthenticated: true,
      accessTokenExpiry: 999,
      refreshTokenExpiry: 999,
      permissionsUnavailable: false,
    }
    const state = reducer(loggedInState, logoutAction())
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.accessTokenExpiry).toBeNull()
    expect(state.refreshTokenExpiry).toBeNull()
  })

  it('removes user from localStorage on logout', () => {
    const loggedInState = {
      user: mockUser,
      isAuthenticated: true,
      accessTokenExpiry: 999,
      refreshTokenExpiry: 999,
      permissionsUnavailable: false,
    }
    reducer(loggedInState, logoutAction())
    expect(localStorage.removeItem).toHaveBeenCalledWith('auth-user')
  })

  it('updateUserAction merges partial fields when a user is present', () => {
    const loggedInState = {
      user: mockUser,
      isAuthenticated: true,
      accessTokenExpiry: 1,
      refreshTokenExpiry: 1,
      permissionsUnavailable: false,
    }
    const state = reducer(loggedInState, updateUserAction({ name: 'New Name' }))
    expect(state.user?.name).toBe('New Name')
    expect(state.user?.email).toBe(mockUser.email)
    expect(localStorage.setItem).toHaveBeenCalledWith('auth-user', expect.any(String))
  })

  it('updateUserAction is a no-op when no user is present', () => {
    const state = reducer(emptyState, updateUserAction({ name: 'X' }))
    expect(state.user).toBeNull()
  })

  // A-02 — records that the permission lookup is failing so the UI can say so
  // instead of implying the account lacks access.
  it('setPermissionsUnavailableAction toggles the flag', () => {
    const set = reducer(emptyState, setPermissionsUnavailableAction(true))
    expect(set.permissionsUnavailable).toBe(true)
    const cleared = reducer(set, setPermissionsUnavailableAction(false))
    expect(cleared.permissionsUnavailable).toBe(false)
  })

  it('loginAction resets a stale permissions-outage flag', () => {
    const stale = { ...emptyState, permissionsUnavailable: true }
    const state = reducer(stale, loginAction(mockUser))
    expect(state.permissionsUnavailable).toBe(false)
  })

  it('logoutAction clears the permissions-outage flag', () => {
    const state = reducer(
      {
        user: mockUser,
        isAuthenticated: true,
        accessTokenExpiry: 999,
        refreshTokenExpiry: 999,
        permissionsUnavailable: true,
      },
      logoutAction(),
    )
    expect(state.permissionsUnavailable).toBe(false)
  })

  it('expireSessionAction clears user, auth, expiries and storage', () => {
    const state = reducer(
      {
        user: mockUser,
        isAuthenticated: true,
        accessTokenExpiry: 999,
        refreshTokenExpiry: 999,
        permissionsUnavailable: true,
      },
      expireSessionAction(),
    )
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.accessTokenExpiry).toBeNull()
    expect(state.refreshTokenExpiry).toBeNull()
    expect(state.permissionsUnavailable).toBe(false)
    expect(localStorage.removeItem).toHaveBeenCalledWith('auth-user')
    expect(localStorage.removeItem).toHaveBeenCalledWith('auth-expiry')
  })
})
