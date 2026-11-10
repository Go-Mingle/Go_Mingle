import type { RootState } from './store'

export const selectAuthUser = (state: RootState) => state.auth.user
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated
export const selectAccessTokenExpiry = (state: RootState) => state.auth.accessTokenExpiry
export const selectRefreshTokenExpiry = (state: RootState) => state.auth.refreshTokenExpiry

export const selectDrawerOpen = (state: RootState) => state.ui.drawerOpen
