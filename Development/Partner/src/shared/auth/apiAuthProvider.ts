import { ENV } from '../../configs/env'
import { AuthError } from './authError'
import { tokenStore } from './tokenStore'
import type { AuthErrorCode, AuthIdentity, PartnerAuthProvider } from './types'

/**
 * Partner sign-in against the GoMingle backend (`VITE_AUTH_MODE=api`).
 *
 * The backend issues its own JWT access + refresh tokens, so the portal can run
 * end-to-end without an AWS Cognito pool — the setup used for local runs and the
 * practicum demo. Same contract as the Cognito and mock providers, so nothing
 * above `getAuthProvider()` changes.
 */

export const PARTNER_AUTH_ENDPOINTS = {
  login: '/api/v1/partner/auth/login',
  refresh: '/api/v1/partner/auth/refresh',
  logout: '/api/v1/partner/auth/logout',
  forgotPassword: '/api/v1/partner/auth/forgot-password',
  confirmForgotPassword: '/api/v1/partner/auth/confirm-forgot-password',
  changePassword: '/api/v1/partner/auth/change-password',
} as const

const TWO_HOURS_MS = 2 * 60 * 60 * 1000

/** Same rule as httpClient: the dev server proxies `/api`, a build calls the API host. */
function url(path: string): string {
  const base = import.meta.env.DEV ? '' : ENV.API_BASE_URL.trim().replace(/\/+$/, '')
  return `${base}${path}`
}

interface TokenResponse {
  accessToken: string
  refreshToken?: string
  /** Seconds. */
  expiresIn?: number
  user?: AuthIdentity
}

interface ErrorBody {
  error?: { code?: string; message?: string }
}

const KNOWN_CODES = new Set<AuthErrorCode>([
  'INVALID_CREDENTIALS',
  'USER_NOT_FOUND',
  'PASSWORD_RESET_REQUIRED',
  'REFRESH_FAILED',
  'INVALID_EMAIL',
  'PRE_AUTH_REJECTED',
  'CODE_MISMATCH',
  'CODE_EXPIRED',
  'INVALID_PASSWORD',
  'SAME_PASSWORD',
  'LIMIT_EXCEEDED',
])

async function post<T>(path: string, body: unknown, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(url(path), { method: 'POST', headers, body: JSON.stringify(body) })
  } catch {
    throw new AuthError('NETWORK')
  }
  if (res.status === 204) return undefined as T
  const data = (await res.json().catch(() => ({}))) as T & ErrorBody
  if (!res.ok) {
    const code = data.error?.code as AuthErrorCode | undefined
    if (code && KNOWN_CODES.has(code)) {
      // Lock / suspension copy is authored server-side and shown verbatim.
      throw new AuthError(code, code === 'PRE_AUTH_REJECTED' ? data.error?.message : undefined)
    }
    throw new AuthError(res.status >= 500 ? 'NETWORK' : 'UNKNOWN', data.error?.message)
  }
  return data
}

function expiresAt(seconds?: number): number {
  return Date.now() + (seconds ? seconds * 1000 : TWO_HOURS_MS)
}

export const apiAuthProvider: PartnerAuthProvider = {
  signIn: async (email: string, password: string): Promise<AuthIdentity> => {
    const data = await post<TokenResponse>(PARTNER_AUTH_ENDPOINTS.login, {
      email: email.trim().toLowerCase(),
      password,
    })
    if (!data.refreshToken || !data.user) throw new AuthError('UNKNOWN')
    tokenStore.setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: expiresAt(data.expiresIn),
      identity: data.user,
    })
    return data.user
  },

  getAccessToken: (): string | null => tokenStore.getAccessToken(),

  refresh: async (): Promise<string> => {
    const refreshToken = tokenStore.getRefreshToken()
    if (!refreshToken) throw new AuthError('REFRESH_FAILED')
    try {
      const data = await post<TokenResponse>(PARTNER_AUTH_ENDPOINTS.refresh, { refreshToken })
      tokenStore.setAccessToken(data.accessToken, expiresAt(data.expiresIn))
      return data.accessToken
    } catch {
      throw new AuthError('REFRESH_FAILED')
    }
  },

  signOut: async (): Promise<void> => {
    const token = tokenStore.getAccessToken()
    tokenStore.clear()
    if (token) await post<void>(PARTNER_AUTH_ENDPOINTS.logout, {}, token).catch(() => undefined)
  },

  getIdentity: (): AuthIdentity | null => tokenStore.getIdentity(),

  forgotPassword: async (email: string): Promise<void> => {
    await post<void>(PARTNER_AUTH_ENDPOINTS.forgotPassword, { email: email.trim().toLowerCase() })
  },

  confirmForgotPassword: async (email: string, code: string, newPassword: string) => {
    await post<void>(PARTNER_AUTH_ENDPOINTS.confirmForgotPassword, {
      email: email.trim().toLowerCase(),
      code,
      newPassword,
    })
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    if (newPassword === currentPassword) throw new AuthError('SAME_PASSWORD')
    await post<void>(
      PARTNER_AUTH_ENDPOINTS.changePassword,
      { currentPassword, newPassword },
      tokenStore.getAccessToken(),
    )
  },
}
