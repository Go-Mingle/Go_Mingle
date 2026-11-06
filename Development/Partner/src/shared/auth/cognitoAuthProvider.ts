import * as Sentry from '@sentry/react'
import type { CognitoUserSession } from 'amazon-cognito-identity-js'
import { ENV } from '../../configs/env'
import { AuthError } from './authError'
import { tokenStore } from './tokenStore'
import type { AuthIdentity, AuthErrorCode, PartnerAuthProvider } from './types'

/**
 * Real GoMingle-Partners pool adapter (BR-01/BR-02).
 *
 * The SDK is pulled in with a dynamic import from the async methods only, so it
 * lands in a lazy chunk rather than the eager bundle — `getAccessToken` and
 * `getIdentity` are served synchronously from {@link tokenStore} and need no SDK.
 */

/** Cognito surfaces failures as `err.name`; map the ones we act on. */
function toAuthErrorCode(name: string | undefined): AuthErrorCode {
  switch (name) {
    case 'NotAuthorizedException':
      return 'INVALID_CREDENTIALS'
    case 'UserNotFoundException':
      return 'USER_NOT_FOUND'
    case 'PasswordResetRequiredException':
      return 'PASSWORD_RESET_REQUIRED'
    case 'InvalidParameterException':
      return 'INVALID_EMAIL'
    case 'CodeMismatchException':
      return 'CODE_MISMATCH'
    case 'ExpiredCodeException':
      return 'CODE_EXPIRED'
    case 'InvalidPasswordException':
      return 'INVALID_PASSWORD'
    case 'LimitExceededException':
    case 'TooManyRequestsException':
    case 'TooManyFailedAttemptsException':
      return 'LIMIT_EXCEEDED'
    case 'NetworkError':
      return 'NETWORK'
    default:
      return 'UNKNOWN'
  }
}

/**
 * The Pre-Auth Lambda rejects logins by throwing `NotAuthorizedException` with
 * its own copy — lockout, per-user suspension, restaurant suspension, or a
 * transient outage. Only the message distinguishes them from a plain wrong
 * password, so match on it and pass the wording straight through.
 *
 * Suspension copy is deliberately identical whether the user or the whole
 * restaurant was suspended: telling them apart would leak which gate denied.
 */
const PRE_AUTH_REJECTION = /locked|suspended|temporarily unavailable/i

function isPreAuthRejection(name: string | undefined, message: string | undefined): boolean {
  return name === 'NotAuthorizedException' && PRE_AUTH_REJECTION.test(message ?? '')
}

/**
 * Sentry is PROD-only (see main.tsx), so in development a captured Cognito
 * failure left no trace at all — which is exactly how a ReferenceError thrown
 * while importing the SDK ended up presenting as a silent "unavailable" message
 * with an empty console. Always leave something visible for the next person.
 */
function reportAuthFailure(error: unknown, context: Record<string, unknown>): void {
  Sentry.captureException(error, {
    tags: { component: 'cognitoAuthProvider', ...context } as Record<string, string>,
    extra: { cognitoName: (error as { name?: string } | null)?.name },
  })
  if (import.meta.env.DEV) {
    console.error('[cognitoAuthProvider] auth failed', context, error)
  }
}

function toAuthError(error: unknown): AuthError {
  const name = (error as { name?: string } | null)?.name
  const message = (error as { message?: string } | null)?.message
  if (isPreAuthRejection(name, message)) {
    return new AuthError('PRE_AUTH_REJECTED', message)
  }
  return new AuthError(toAuthErrorCode(name), message)
}

/**
 * Login failures must never reveal whether an account exists (BR-04), so an
 * unknown email is collapsed into the same code as a wrong password. Pre-Auth
 * rejections keep their own code because their copy is meant to be shown.
 */
function toSignInError(error: unknown): AuthError {
  const authError = toAuthError(error)
  // Cognito failures never reached Sentry before, which made a misconfigured
  // app client indistinguishable from a wrong password from the UI alone.
  if (authError.code !== 'INVALID_CREDENTIALS' && authError.code !== 'PRE_AUTH_REJECTED') {
    reportAuthFailure(error, { phase: 'signIn', authCode: authError.code })
  }
  if (authError.code === 'USER_NOT_FOUND') {
    return new AuthError('INVALID_CREDENTIALS', authError.message)
  }
  return authError
}

async function loadSdk() {
  return import('amazon-cognito-identity-js')
}

async function getUserPool() {
  const { CognitoUserPool } = await loadSdk()
  return new CognitoUserPool({
    UserPoolId: ENV.COGNITO_PARTNERS_POOL_ID,
    ClientId: ENV.COGNITO_PARTNERS_CLIENT_ID,
  })
}

/** Claims arrive as `unknown`; only string claims are meaningful to us. */
function claim(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]
  return typeof value === 'string' ? value : ''
}

/** Reads the identity out of the ID token's payload. */
function identityFromSession(session: CognitoUserSession): AuthIdentity {
  const payload = session.getIdToken().payload as Record<string, unknown>
  const email = claim(payload, 'email')
  return {
    id: claim(payload, 'sub'),
    email,
    fullName: claim(payload, 'name') || email,
  }
}

function persist(session: CognitoUserSession, identity: AuthIdentity): void {
  tokenStore.setTokens({
    accessToken: session.getAccessToken().getJwtToken(),
    refreshToken: session.getRefreshToken().getToken(),
    // Cognito reports expiry in seconds since the epoch.
    expiresAt: session.getAccessToken().getExpiration() * 1000,
    identity,
  })
}

export const cognitoAuthProvider: PartnerAuthProvider = {
  signIn: async (email: string, password: string): Promise<AuthIdentity> => {
    // Loading the SDK and building the pool can throw on their own — a malformed
    // pool id, or a chunk that fails to load. Those are configuration faults, not
    // credential failures, and unwrapped they would surface as a bare "something
    // went wrong" with nothing to act on.
    let user: InstanceType<Awaited<ReturnType<typeof loadSdk>>['CognitoUser']>
    let details: InstanceType<Awaited<ReturnType<typeof loadSdk>>['AuthenticationDetails']>
    try {
      const { AuthenticationDetails, CognitoUser } = await loadSdk()
      const pool = await getUserPool()
      user = new CognitoUser({ Username: email, Pool: pool })
      details = new AuthenticationDetails({ Username: email, Password: password })
    } catch (error) {
      // Must go through reportAuthFailure, not Sentry directly: Sentry is
      // PROD-only, so a raw capture here left `vite dev` with a silent generic
      // "unavailable" message and an empty console — the exact reason this
      // failure mode went undiagnosed twice.
      reportAuthFailure(error, {
        phase: 'setup',
        hasPoolId: Boolean(ENV.COGNITO_PARTNERS_POOL_ID),
        hasClientId: Boolean(ENV.COGNITO_PARTNERS_CLIENT_ID),
      })
      throw new AuthError('CONFIG_ERROR', (error as Error).message)
    }

    const session = await new Promise<CognitoUserSession>((resolve, reject) => {
      user.authenticateUser(details, {
        onSuccess: resolve,
        onFailure: (err: unknown) => {
          reject(toSignInError(err))
        },
      })
    })

    const identity = identityFromSession(session)
    persist(session, identity)
    return identity
  },

  getAccessToken: (): string | null => tokenStore.getAccessToken(),

  refresh: async (): Promise<string> => {
    const refreshToken = tokenStore.getRefreshToken()
    const identity = tokenStore.getIdentity()
    if (!refreshToken || !identity?.email) {
      throw new AuthError('REFRESH_FAILED')
    }

    const { CognitoRefreshToken, CognitoUser } = await loadSdk()
    const pool = await getUserPool()
    const user = new CognitoUser({ Username: identity.email, Pool: pool })

    try {
      const session = await new Promise<CognitoUserSession>((resolve, reject) => {
        user.refreshSession(
          new CognitoRefreshToken({ RefreshToken: refreshToken }),
          (err: unknown, result: CognitoUserSession) => {
            if (err) reject(toAuthError(err))
            else resolve(result)
          },
        )
      })
      persist(session, identityFromSession(session))
      return session.getAccessToken().getJwtToken()
    } catch (error) {
      // A dead refresh token is unrecoverable — drop the session so the app
      // routes to login instead of retrying forever.
      tokenStore.clear()
      throw new AuthError('REFRESH_FAILED', (error as Error).message)
    }
  },

  signOut: async (): Promise<void> => {
    const identity = tokenStore.getIdentity()
    tokenStore.clear()
    if (!identity?.email) return

    try {
      const { CognitoUser } = await loadSdk()
      const pool = await getUserPool()
      const user = new CognitoUser({ Username: identity.email, Pool: pool })
      // globalSignOut revokes the refresh token so a captured one cannot be
      // replayed (BR-14); plain signOut() only drops local SDK state. It needs a
      // live session, so fall back to the local clear when there isn't one.
      await new Promise<void>((resolve) => {
        user.getSession((err: unknown) => {
          if (err) {
            resolve()
            return
          }
          user.globalSignOut({ onSuccess: () => resolve(), onFailure: () => resolve() })
        })
      })
    } catch {
      // Local tokens are already gone; a failed pool round-trip must not block
      // the user from reaching the login screen.
    }
  },

  getIdentity: (): AuthIdentity | null => tokenStore.getIdentity(),

  forgotPassword: async (email: string): Promise<void> => {
    const { CognitoUser } = await loadSdk()
    const pool = await getUserPool()
    const user = new CognitoUser({ Username: email, Pool: pool })

    try {
      await new Promise<void>((resolve, reject) => {
        user.forgotPassword({
          onSuccess: () => resolve(),
          onFailure: (err: unknown) => {
            reject(toAuthError(err))
          },
        })
      })
    } catch (error) {
      // Enumeration-safe (BR-08): an unregistered or suspended address must
      // produce the same "code sent" confirmation as a real one. Rate limits
      // and outages are still surfaced — they say nothing about existence.
      const code = error instanceof AuthError ? error.code : 'UNKNOWN'
      if (code === 'USER_NOT_FOUND' || code === 'INVALID_CREDENTIALS') return
      throw error
    }
  },

  confirmForgotPassword: async (
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> => {
    const { CognitoUser } = await loadSdk()
    const pool = await getUserPool()
    const user = new CognitoUser({ Username: email, Pool: pool })

    await new Promise<void>((resolve, reject) => {
      user.confirmPassword(code, newPassword, {
        onSuccess: () => resolve(),
        onFailure: (err: unknown) => {
          reject(toAuthError(err))
        },
      })
    })
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    const identity = tokenStore.getIdentity()
    if (!identity?.email) throw new AuthError('INVALID_CREDENTIALS')

    /**
     * MET-1290 — Cognito has no password-history rule, so `ChangePassword`
     * happily accepts the password already in use and reports success. Reject it
     * before the refresh round-trip: the pool cannot do it for us.
     */
    if (newPassword === currentPassword) throw new AuthError('SAME_PASSWORD')

    const refreshToken = tokenStore.getRefreshToken()
    if (!refreshToken) throw new AuthError('REFRESH_FAILED')

    const { CognitoRefreshToken, CognitoUser } = await loadSdk()
    const pool = await getUserPool()
    const user = new CognitoUser({ Username: identity.email, Pool: pool })

    /**
     * ChangePassword needs a live `signInUserSession` on this user instance.
     *
     * `getSession()` cannot supply one here: it reads the SDK's **own**
     * localStorage cache, which `persist()` never maintains — we keep tokens in
     * `tokenStore` instead — so it failed locally, before any request, and the
     * modal could only report a generic error. Refreshing sets the session as a
     * side effect and uses the refresh token we actually hold, which is the same
     * mechanism `refresh` above relies on. The fresh tokens are persisted so this
     * does not silently roll the stored pair backwards.
     */
    const session = await new Promise<CognitoUserSession>((resolve, reject) => {
      user.refreshSession(
        new CognitoRefreshToken({ RefreshToken: refreshToken }),
        (err: unknown, result: CognitoUserSession) => {
          if (err) reject(new AuthError('REFRESH_FAILED', (err as Error).message))
          else resolve(result)
        },
      )
    })
    persist(session, identityFromSession(session))

    await new Promise<void>((resolve, reject) => {
      user.changePassword(currentPassword, newPassword, (err: unknown) => {
        if (err) reject(toAuthError(err))
        else resolve()
      })
    })
  },
}
