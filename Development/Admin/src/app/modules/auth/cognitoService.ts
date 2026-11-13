// Cognito Authentication Service
// Provides login/logout operations against AWS Cognito User Pool.
// Replaces legacy email+password auth with enterprise-grade identity management:
// - Handles password complexity, lockout, MFA readiness
// - Returns user claims (id, email, name) from Cognito user pool attributes
// - Called by LoginForm and UserMenuDropdown to manage auth lifecycle

import type {
  CognitoIdentityProviderClient,
  InitiateAuthCommandInput,
} from '@aws-sdk/client-cognito-identity-provider'
import { ENV } from '../../../configs/env'
import { isMocksEnabled } from '../../../shared/api/mocksEnabled'
import type { AuthUser } from './types'

// Token refresh timing: refresh when token has < 5 minutes remaining
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000

// AWS Cognito Identity Provider client, built on first use rather than at module
// scope. The SDK throws "Region is missing" from its constructor when the region
// is empty, so constructing eagerly turned a missing env var into an *import*
// failure: every module that transitively imports this one (httpClient →
// sessionManager → here) failed to load, and CI — which has no `.env` — could not
// collect a single test from those files. Deferring the construction keeps the
// failure at the point of use, where it is catchable and reportable.
let client: CognitoIdentityProviderClient | null = null

/**
 * The AWS SDK is loaded on first use, so deployments that sign in against the
 * GoMingle API (VITE_AUTH_MODE=api) never download it.
 */
const loadSdk = () => import('@aws-sdk/client-cognito-identity-provider')

async function getClient(): Promise<CognitoIdentityProviderClient> {
  const { CognitoIdentityProviderClient } = await loadSdk()
  if (!client) {
    // Missing config means the .env file is absent or the dev server needs a
    // restart to pick up env changes. Warned here rather than at module scope so
    // it fires for a developer actually attempting auth, not for every test file
    // that merely imports this module.
    if (!ENV.AWS_REGION || !ENV.COGNITO_CLIENT_ID) {
      console.error(
        '[Cognito] VITE_AWS_REGION and VITE_COGNITO_CLIENT_ID must be set in your .env file.',
      )
    }
    client = new CognitoIdentityProviderClient({ region: ENV.AWS_REGION })
  }
  return client
}

// ── Backend (API) auth mode ─────────────────────────────────────────────────
// When no Cognito pool is configured (local runs, the practicum demo), admins
// sign in against the GoMingle backend, which issues its own JWTs. The public
// functions below keep their names and contracts, so LoginForm, the session
// manager and the sign-out paths need no changes.

/** True when sign-in goes to the GoMingle backend instead of Cognito. */
export function isApiAuthMode(): boolean {
  if (ENV.AUTH_MODE === 'api') return true
  if (ENV.AUTH_MODE === 'cognito') return false
  return !(ENV.AWS_REGION && ENV.COGNITO_CLIENT_ID)
}

const API_AUTH = {
  login: '/api/v1/auth/login',
  refresh: '/api/v1/auth/refresh',
  logout: '/api/v1/auth/logout',
} as const

function authUrl(path: string): string {
  const base = ENV.API_BASE_URL
  return !isMocksEnabled() && base ? `${base.replace(/\/$/, '')}${path}` : path
}

/** Error whose `name` mirrors the Cognito exception, so mapCognitoErrorToCode applies unchanged. */
function apiAuthError(status: number, code: string | undefined, message: string): Error {
  const err = new Error(message)
  if (status === 401) err.name = 'NotAuthorizedException'
  else if (status === 403 || status === 423) err.name = 'UserLambdaValidationException'
  else if (status === 429) err.name = 'TooManyRequestsException'
  else if (code === 'ERR_PASSWORD_RESET_REQUIRED') err.name = 'PasswordResetRequiredException'
  else err.name = 'NetworkingError'
  return err
}

interface ApiAuthResponse {
  accessToken: string
  refreshToken?: string
  user?: { id: string; email: string; fullName?: string }
}

async function postAuth(path: string, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    return await fetch(authUrl(path), { method: 'POST', headers, body: JSON.stringify(body) })
  } catch {
    const err = new Error('Network error')
    err.name = 'NetworkingError'
    throw err
  }
}

async function readAuthResponse(res: Response): Promise<ApiAuthResponse> {
  const data = (await res.json().catch(() => ({}))) as ApiAuthResponse & {
    error?: { code?: string; message?: string }
  }
  if (!res.ok || !data.accessToken) {
    throw apiAuthError(res.status, data.error?.code, data.error?.message ?? 'Sign-in failed')
  }
  return data
}

async function apiLogin(email: string, password: string): Promise<CognitoLoginResult> {
  const data = await readAuthResponse(await postAuth(API_AUTH.login, { email, password }))
  localStorage.setItem('auth-token', data.accessToken)
  if (data.refreshToken) localStorage.setItem('auth-refresh-token', data.refreshToken)
  const name = data.user?.fullName || data.user?.email || email
  return {
    accessToken: data.accessToken,
    user: {
      id: data.user?.id ?? '',
      email: data.user?.email ?? email,
      name,
      role: '',
      permissions: [],
      fullAccess: false,
      initials: name.slice(0, 2).toUpperCase(),
    },
  }
}

// Result type returned from successful Cognito login containing auth token and user profile
export interface CognitoLoginResult {
  accessToken: string
  user: AuthUser
}

// Authenticates user with Cognito using email/password credentials.
// Returns access token and user profile for use in app state management.
// Throws error if credentials invalid or Cognito service unavailable.
export async function cognitoLogin(email: string, password: string): Promise<CognitoLoginResult> {
  if (isApiAuthMode()) return apiLogin(email, password)
  const authResult = await (
    await getClient()
  ).send(
    new (await loadSdk()).InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: ENV.COGNITO_CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }),
  )

  const accessToken = authResult.AuthenticationResult?.AccessToken
  if (!accessToken) throw new Error('No access token returned from Cognito')

  // Backend AdminCognitoJwtStrategy validates the `client_id` claim, which is only present
  // in Cognito access tokens (ID tokens use `aud` instead). Must send access token.
  localStorage.setItem('auth-token', accessToken)

  // Store refresh token if available for token renewal (usually available after initial auth)
  const refreshToken = authResult.AuthenticationResult?.RefreshToken
  if (refreshToken) {
    localStorage.setItem('auth-refresh-token', refreshToken)
  }

  const userResult = await (
    await getClient()
  ).send(new (await loadSdk()).GetUserCommand({ AccessToken: accessToken }))
  // Cognito returns user attributes as array of { Name, Value } pairs; convert to object for easier access
  const attrs = Object.fromEntries(
    (userResult.UserAttributes ?? []).map((a) => [a.Name ?? '', a.Value ?? '']),
  )

  // Construct display name with fallback: use 'name' claim if available, else email, else login email
  const displayName = attrs['name'] ?? attrs['email'] ?? email
  // Map Cognito user attributes to the base app AuthUser. Cognito provides identity
  // only — role, permissions and fullAccess are resolved from GET /api/v1/auth/me
  // → GET /api/v1/roles/{id} by the caller (LoginForm) and merged in before dispatching loginAction.
  const user: AuthUser = {
    id: attrs['sub'] ?? '',
    email: attrs['email'] ?? email,
    name: displayName,
    role: '',
    permissions: [],
    fullAccess: false,
    initials: displayName.slice(0, 2).toUpperCase(),
  }

  return { accessToken, user }
}

// Signs out user globally from all devices and sessions using Cognito.
// Invalidates the access token immediately at the identity provider level.
// Called when user initiates sign-out; must be paired with local Redux logout action.
export async function cognitoSignOut(accessToken: string): Promise<void> {
  if (isApiAuthMode()) {
    await postAuth(API_AUTH.logout, {}, accessToken)
    return
  }
  await (
    await getClient()
  ).send(new (await loadSdk()).GlobalSignOutCommand({ AccessToken: accessToken }))
}

// Refreshes access token using stored refresh token from localStorage
// Call this when access token is approaching expiration (< 5 min remaining)
// Returns new access token to store in localStorage
export async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem('auth-refresh-token')
  if (!refreshToken) throw new Error('No refresh token found')

  if (isApiAuthMode()) {
    const data = await readAuthResponse(await postAuth(API_AUTH.refresh, { refreshToken }))
    localStorage.setItem('auth-token', data.accessToken)
    if (data.refreshToken) localStorage.setItem('auth-refresh-token', data.refreshToken)
    localStorage.setItem('auth-token-timestamp', Date.now().toString())
    return data.accessToken
  }

  const authResult = await (
    await getClient()
  ).send(
    new (await loadSdk()).InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: ENV.COGNITO_CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    } as InitiateAuthCommandInput),
  )

  const newAccessToken = authResult.AuthenticationResult?.AccessToken
  if (!newAccessToken) throw new Error('No access token returned from token refresh')

  localStorage.setItem('auth-token', newAccessToken)
  localStorage.setItem('auth-token-timestamp', Date.now().toString())
  return newAccessToken
}

// Checks if access token should be refreshed (< 5 min remaining)
// Returns true if refresh is needed, false if token is still valid
export function shouldRefreshToken(): boolean {
  const tokenTimestamp = localStorage.getItem('auth-token-timestamp')
  if (!tokenTimestamp) return false

  const loginTime = parseInt(tokenTimestamp, 10)
  const twoHoursMs = 2 * 60 * 60 * 1000
  const tokenExpiry = loginTime + twoHoursMs
  const timeUntilExpiry = tokenExpiry - Date.now()

  return timeUntilExpiry < TOKEN_REFRESH_THRESHOLD_MS
}

// Maps Cognito errors to spec-defined error codes for consistent error handling
// Enables frontend to provide context-aware error messages to users
export function mapCognitoErrorToCode(err: unknown): string {
  // AWS SDK v3 puts the error type in err.name (e.g. "NotAuthorizedException"),
  // not in err.message — check both for robustness
  const name = err instanceof Error ? err.name : ''
  const message = err instanceof Error ? err.message : String(err)

  // Password-related errors
  if (name === 'InvalidPasswordException' || message.includes('InvalidPasswordException'))
    return 'ERR_INVALID_PASSWORD'
  if (name === 'PasswordResetRequiredException' || message.includes('PasswordResetRequired'))
    return 'ERR_PASSWORD_RESET_REQUIRED'

  // User/account state errors
  if (name === 'UserNotConfirmedException' || message.includes('UserNotConfirmedException'))
    return 'ERR_USER_NOT_CONFIRMED'
  if (name === 'UserNotFoundException' || message.includes('UserNotFoundException'))
    return 'ERR_USER_NOT_FOUND'
  if (name === 'UsernameExistsException' || message.includes('UsernameExistsException'))
    return 'ERR_USER_ALREADY_EXISTS'
  if (name === 'UserLambdaValidationException' || message.includes('UserLambdaValidationException'))
    return 'ERR_ACCOUNT_LOCKED'
  if (name === 'TooManyRequestsException' || message.includes('TooManyRequestsException'))
    return 'ERR_TOO_MANY_ATTEMPTS'

  // Authentication failure — NotAuthorizedException is the primary Cognito error for wrong credentials
  if (
    name === 'NotAuthorizedException' ||
    message.includes('NotAuthorizedException') ||
    message.includes('Invalid') ||
    message.includes('invalid')
  )
    return 'ERR_INVALID_CREDENTIALS'

  // Network/service errors
  if (
    name === 'NetworkingError' ||
    name === 'TimeoutError' ||
    message.includes('NetworkingError') ||
    message.includes('TimeoutError')
  )
    return 'ERR_COGNITO_UNAVAILABLE'

  return 'ERR_AUTHENTICATION_FAILED'
}
