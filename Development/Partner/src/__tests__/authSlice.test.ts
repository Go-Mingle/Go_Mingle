import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  authSlice,
  loginAction,
  logoutAction,
  updateUserAction,
  renewAccessTokenAction,
  expireSessionAction,
} from '../shared/store/authSlice'

const { reducer } = authSlice

const mockUser = {
  id: 'user-1',
  name: 'Super Admin',
  email: 'admin@gomingle.com',
  role: 'Super Admin',
  initials: 'SA',
}

const emptyState = {
  user: null,
  isAuthenticated: false,
  accessTokenExpiry: null,
  refreshTokenExpiry: null,
}

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
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

  it('renewAccessTokenAction extends accessTokenExpiry when refresh is still valid', () => {
    const future = Date.now() + 1_000_000
    const state = reducer(
      {
        user: mockUser,
        isAuthenticated: true,
        accessTokenExpiry: 0,
        refreshTokenExpiry: future,
      },
      renewAccessTokenAction(),
    )
    expect(state.accessTokenExpiry).not.toBe(0)
    expect((state.accessTokenExpiry ?? 0) > Date.now()).toBe(true)
  })

  it('renewAccessTokenAction also updates the persisted expiry when present', () => {
    const future = Date.now() + 1_000_000
    ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      JSON.stringify({ access: 1, refresh: future }),
    )
    reducer(
      {
        user: mockUser,
        isAuthenticated: true,
        accessTokenExpiry: 0,
        refreshTokenExpiry: future,
      },
      renewAccessTokenAction(),
    )
    expect(localStorage.setItem).toHaveBeenCalledWith('auth-expiry', expect.any(String))
  })

  it('renewAccessTokenAction is a no-op when refresh has expired', () => {
    const state = reducer(
      {
        user: mockUser,
        isAuthenticated: true,
        accessTokenExpiry: 0,
        refreshTokenExpiry: 1,
      },
      renewAccessTokenAction(),
    )
    expect(state.accessTokenExpiry).toBe(0)
  })

  it('expireSessionAction clears user, auth, expiries and storage', () => {
    const state = reducer(
      {
        user: mockUser,
        isAuthenticated: true,
        accessTokenExpiry: 999,
        refreshTokenExpiry: 999,
      },
      expireSessionAction(),
    )
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.accessTokenExpiry).toBeNull()
    expect(state.refreshTokenExpiry).toBeNull()
    expect(localStorage.removeItem).toHaveBeenCalledWith('auth-user')
    expect(localStorage.removeItem).toHaveBeenCalledWith('auth-expiry')
  })
})
