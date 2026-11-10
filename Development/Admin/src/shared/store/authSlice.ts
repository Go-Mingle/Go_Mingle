import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  /** Module permission keys granted to the user's role (resolved via GET /api/v1/roles/{id}). */
  permissions: string[]
  /** When true the role has access to every module regardless of `permissions`. */
  fullAccess: boolean
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
  /**
   * A-02 (pentest) — GET /auth/me returns HTTP 500 when the caller's role has
   * been soft-deleted. That used to be swallowed silently, leaving the operator
   * on a generic "Access denied" page indistinguishable from a real permission
   * denial. Set when the profile/permission lookup fails for a reason other than
   * an expired or rejected session; cleared as soon as a lookup succeeds.
   */
  permissionsUnavailable: boolean
}

/**
 * MET-1286 — the session is stored browser-wide, not per-tab.
 *
 * The tokens this state describes have always lived in `localStorage`
 * (`auth-token` / `auth-refresh-token`, written by `cognitoService`), but the
 * identity and expiry describing them were kept in `sessionStorage`, which is
 * scoped to one tab. Opening the portal in a second tab therefore booted with a
 * perfectly valid token and an empty store, so `AuthGuard` read
 * `isAuthenticated: false` and redirected to `/login` while the first tab stayed
 * signed in. J1 v4.1 US-002 lists "portal open in two tabs" as a supported case,
 * so this state is now scoped exactly like the tokens it describes.
 *
 * The **access** token deliberately plays no part in the validity test: an
 * expired one is recoverable — `httpClient` renews it against the refresh token
 * on the first `401 ERR_TOKEN_EXPIRED` (FE1 BR-02) — so a tab restored with a
 * stale access token self-heals on its first call. Only the refresh window
 * closing is terminal (US-001 AC-008). The server stays authoritative either
 * way: `AuthGuard` calls `GET /api/v1/auth/me` on mount and expires the session
 * on 401 or `ERR_ACCOUNT_SUSPENDED` (US-001 AC-010).
 */
const stored = localStorage.getItem('auth-user')
const storedExpiry = localStorage.getItem('auth-expiry')
const expiry = storedExpiry
  ? (JSON.parse(storedExpiry) as { access: number; refresh: number })
  : null

/**
 * A restore also requires the token the session is actually made of. Without
 * this check a profile that outlived its tokens — a sign-out or termination that
 * cleared them but not the profile, or an entry written by a build that used a
 * different store — would present as an authenticated session that 401s on every
 * call. US-004 AC-007 is explicit that a signed-out session must not be
 * restorable.
 */
const hasToken = !!localStorage.getItem('auth-token')
const isSessionValid = hasToken && !!stored && !!expiry && Date.now() < expiry.refresh

if (!isSessionValid && stored) {
  localStorage.removeItem('auth-user')
  localStorage.removeItem('auth-expiry')
}

const initialState: AuthState = {
  user: isSessionValid ? (JSON.parse(stored!) as AuthUser) : null,
  isAuthenticated: isSessionValid,
  accessTokenExpiry: expiry?.access ?? null,
  refreshTokenExpiry: expiry?.refresh ?? null,
  permissionsUnavailable: false,
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function clearAuth(state: AuthState) {
  state.user = null
  state.isAuthenticated = false
  state.accessTokenExpiry = null
  state.refreshTokenExpiry = null
  state.permissionsUnavailable = false
}

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
      state.permissionsUnavailable = false
      localStorage.setItem('auth-user', JSON.stringify(action.payload))
      localStorage.setItem(
        'auth-expiry',
        JSON.stringify({ access: state.accessTokenExpiry, refresh: state.refreshTokenExpiry }),
      )
    },
    logoutAction: (state) => {
      clearAuth(state)
      localStorage.removeItem('auth-user')
      localStorage.removeItem('auth-expiry')
      localStorage.removeItem('auth-token')
      localStorage.removeItem('auth-refresh-token')
      localStorage.removeItem('auth-token-timestamp')
    },
    updateUserAction: (state, action: PayloadAction<Partial<AuthUser>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload }
        localStorage.setItem('auth-user', JSON.stringify(state.user))
      }
    },
    /**
     * A-02 — records whether the permission lookup is currently failing, so the
     * unauthorized page can distinguish a server fault from a real denial. The
     * AuthGuard poll clears it on the next successful tick, so the banner
     * disappears on its own once the backend recovers.
     */
    setPermissionsUnavailableAction: (state, action: PayloadAction<boolean>) => {
      state.permissionsUnavailable = action.payload
    },
    /**
     * Ends the session without the user asking (FE1 BR-07): expiry that could
     * not be renewed, an invalid token, or a suspended account. Identical in
     * effect to `logoutAction`; kept separate because the two are triggered by
     * different journeys and read very differently at the call site.
     */
    expireSessionAction: (state) => {
      clearAuth(state)
      localStorage.removeItem('auth-user')
      localStorage.removeItem('auth-expiry')
      localStorage.removeItem('auth-token')
      localStorage.removeItem('auth-refresh-token')
      localStorage.removeItem('auth-token-timestamp')
    },
  },
})

export const {
  loginAction,
  logoutAction,
  updateUserAction,
  expireSessionAction,
  setPermissionsUnavailableAction,
} = authSlice.actions
