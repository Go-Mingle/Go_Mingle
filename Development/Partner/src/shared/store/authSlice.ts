import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  initials: string
  color?: string
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  /** Unix ms timestamp when access token expires (2h after login) */
  accessTokenExpiry: number | null
  /** Unix ms timestamp when refresh token expires (7d after login) */
  refreshTokenExpiry: number | null
}

const stored = localStorage.getItem('auth-user')
const storedExpiry = localStorage.getItem('auth-expiry')
const expiry = storedExpiry
  ? (JSON.parse(storedExpiry) as { access: number; refresh: number })
  : null

// If both tokens have expired, treat as logged out
const isSessionValid = !!stored && !!expiry && Date.now() < expiry.refresh

if (!isSessionValid && stored) {
  localStorage.removeItem('auth-user')
  localStorage.removeItem('auth-expiry')
}

const initialState: AuthState = {
  user: isSessionValid ? (JSON.parse(stored!) as AuthUser) : null,
  isAuthenticated: isSessionValid,
  accessTokenExpiry: expiry?.access ?? null,
  refreshTokenExpiry: expiry?.refresh ?? null,
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginAction: (state, action: PayloadAction<AuthUser>) => {
      const now = Date.now()
      state.user = action.payload
      state.isAuthenticated = true
      state.accessTokenExpiry = now + TWO_HOURS_MS
      state.refreshTokenExpiry = now + SEVEN_DAYS_MS
      localStorage.setItem('auth-user', JSON.stringify(action.payload))
      localStorage.setItem(
        'auth-expiry',
        JSON.stringify({ access: now + TWO_HOURS_MS, refresh: now + SEVEN_DAYS_MS }),
      )
    },
    logoutAction: (state) => {
      state.user = null
      state.isAuthenticated = false
      state.accessTokenExpiry = null
      state.refreshTokenExpiry = null
      localStorage.removeItem('auth-user')
      localStorage.removeItem('auth-expiry')
    },
    updateUserAction: (state, action: PayloadAction<Partial<AuthUser>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload }
        localStorage.setItem('auth-user', JSON.stringify(state.user))
      }
    },
    /** Called by AuthGuard when access token has expired but refresh is valid — silently renew */
    renewAccessTokenAction: (state) => {
      if (state.refreshTokenExpiry && Date.now() < state.refreshTokenExpiry) {
        const newExpiry = Date.now() + TWO_HOURS_MS
        state.accessTokenExpiry = newExpiry
        const storedExp = localStorage.getItem('auth-expiry')
        if (storedExp) {
          const parsed = JSON.parse(storedExp) as { access: number; refresh: number }
          localStorage.setItem('auth-expiry', JSON.stringify({ ...parsed, access: newExpiry }))
        }
      }
    },
    /** Called by AuthGuard when both tokens have expired — force logout */
    expireSessionAction: (state) => {
      state.user = null
      state.isAuthenticated = false
      state.accessTokenExpiry = null
      state.refreshTokenExpiry = null
      localStorage.removeItem('auth-user')
      localStorage.removeItem('auth-expiry')
    },
  },
})

export const {
  loginAction,
  logoutAction,
  updateUserAction,
  renewAccessTokenAction,
  expireSessionAction,
} = authSlice.actions
