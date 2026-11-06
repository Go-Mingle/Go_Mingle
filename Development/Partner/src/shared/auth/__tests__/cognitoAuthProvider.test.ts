import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthError } from '../authError'
import { tokenStore } from '../tokenStore'

/** A minimal stand-in for the Cognito session object the SDK hands back. */
function fakeSession(over: { sub?: string; email?: string; name?: unknown } = {}) {
  return {
    getAccessToken: () => ({
      getJwtToken: () => 'access-jwt',
      getExpiration: () => 1_700_000_000,
    }),
    getRefreshToken: () => ({ getToken: () => 'refresh-jwt' }),
    getIdToken: () => ({
      payload: {
        sub: over.sub ?? 'cognito-sub-1',
        email: over.email ?? 'laiba@aurelia.pk',
        ...('name' in over ? { name: over.name } : { name: 'Laiba Hashmi' }),
      },
    }),
  }
}

const authenticateUser = vi.fn()
const refreshSession = vi.fn()
const signOut = vi.fn()
const poolSignUp = vi.fn()
const resendConfirmationCode = vi.fn()
const forgotPassword = vi.fn()
const confirmPassword = vi.fn()
const changePassword = vi.fn()
const globalSignOut = vi.fn()
const getSession = vi.fn()
const CognitoUserPool = vi.fn()

vi.mock('amazon-cognito-identity-js', () => ({
  CognitoUserPool: class {
    signUp = poolSignUp
    constructor(config: unknown) {
      CognitoUserPool(config)
    }
  },
  CognitoUser: class {
    authenticateUser = authenticateUser
    refreshSession = refreshSession
    signOut = signOut
    resendConfirmationCode = resendConfirmationCode
    forgotPassword = forgotPassword
    confirmPassword = confirmPassword
    changePassword = changePassword
    globalSignOut = globalSignOut
    getSession = getSession
  },
  // Plain holders — parameter properties are not erasable syntax.
  AuthenticationDetails: class {
    config: unknown
    constructor(config: unknown) {
      this.config = config
    }
  },
  CognitoRefreshToken: class {
    config: unknown
    constructor(config: unknown) {
      this.config = config
    }
  },
}))

vi.mock('../../../configs/env', () => ({
  ENV: {
    COGNITO_PARTNERS_POOL_ID: 'me-central-1_test',
    COGNITO_PARTNERS_CLIENT_ID: 'client-test',
    COGNITO_REGION: 'me-central-1',
  },
}))

const { cognitoAuthProvider } = await import('../cognitoAuthProvider')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('cognitoAuthProvider.signIn', () => {
  it('authenticates against the partners pool and persists the tokens', async () => {
    authenticateUser.mockImplementation(
      (_details: unknown, callbacks: { onSuccess: (s: unknown) => void }) => {
        callbacks.onSuccess(fakeSession())
      },
    )

    const identity = await cognitoAuthProvider.signIn('laiba@aurelia.pk', 'pw')

    expect(identity).toEqual({
      id: 'cognito-sub-1',
      email: 'laiba@aurelia.pk',
      fullName: 'Laiba Hashmi',
    })
    expect(CognitoUserPool).toHaveBeenCalledWith({
      UserPoolId: 'me-central-1_test',
      ClientId: 'client-test',
    })
    expect(tokenStore.getAccessToken()).toBe('access-jwt')
    expect(tokenStore.getRefreshToken()).toBe('refresh-jwt')
    // Cognito reports seconds; we store milliseconds.
    expect(tokenStore.getExpiresAt()).toBe(1_700_000_000_000)
  })

  it('falls back to the email when the ID token carries no name claim', async () => {
    authenticateUser.mockImplementation((_d: unknown, cb: { onSuccess: (s: unknown) => void }) => {
      cb.onSuccess(fakeSession({ name: undefined }))
    })

    const identity = await cognitoAuthProvider.signIn('laiba@aurelia.pk', 'pw')
    expect(identity.fullName).toBe('laiba@aurelia.pk')
  })

  it('ignores a non-string name claim', async () => {
    authenticateUser.mockImplementation((_d: unknown, cb: { onSuccess: (s: unknown) => void }) => {
      cb.onSuccess(fakeSession({ name: { given: 'Laiba' } }))
    })

    const identity = await cognitoAuthProvider.signIn('laiba@aurelia.pk', 'pw')
    expect(identity.fullName).toBe('laiba@aurelia.pk')
  })

  it.each([
    ['NotAuthorizedException', 'INVALID_CREDENTIALS'],
    // An unknown email must look exactly like a wrong password (BR-04).
    ['UserNotFoundException', 'INVALID_CREDENTIALS'],
    ['PasswordResetRequiredException', 'PASSWORD_RESET_REQUIRED'],
    ['NetworkError', 'NETWORK'],
    ['SomethingElseException', 'UNKNOWN'],
  ])('maps %s to AuthError %s', async (name, expected) => {
    authenticateUser.mockImplementation((_d: unknown, cb: { onFailure: (e: unknown) => void }) => {
      cb.onFailure({ name, message: 'from cognito' })
    })

    const error = (await cognitoAuthProvider
      .signIn('laiba@aurelia.pk', 'bad')
      .catch((e: unknown) => e)) as AuthError

    expect(error).toBeInstanceOf(AuthError)
    expect(error.code).toBe(expected)
    expect(error.message).toBe('from cognito')
  })

  it('maps a failure with no name to UNKNOWN', async () => {
    authenticateUser.mockImplementation((_d: unknown, cb: { onFailure: (e: unknown) => void }) => {
      cb.onFailure(null)
    })

    const error = (await cognitoAuthProvider
      .signIn('laiba@aurelia.pk', 'bad')
      .catch((e: unknown) => e)) as AuthError

    expect(error.code).toBe('UNKNOWN')
  })
})

describe('cognitoAuthProvider.refresh', () => {
  it('exchanges the refresh token and stores the new access token', async () => {
    tokenStore.setTokens({
      accessToken: 'old',
      refreshToken: 'refresh-jwt',
      expiresAt: 1,
      identity: { id: 'cognito-sub-1', email: 'laiba@aurelia.pk', fullName: 'Laiba Hashmi' },
    })
    refreshSession.mockImplementation((_token: unknown, cb: (e: unknown, s: unknown) => void) => {
      cb(null, fakeSession())
    })

    await expect(cognitoAuthProvider.refresh()).resolves.toBe('access-jwt')
    expect(tokenStore.getAccessToken()).toBe('access-jwt')
  })

  it('fails without clearing when there is no refresh token', async () => {
    const error = (await cognitoAuthProvider.refresh().catch((e: unknown) => e)) as AuthError
    expect(error).toBeInstanceOf(AuthError)
    expect(error.code).toBe('REFRESH_FAILED')
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('fails when a refresh token exists but the identity does not', async () => {
    tokenStore.setTokens({ accessToken: 'old', refreshToken: 'refresh-jwt', expiresAt: 1 })

    const error = (await cognitoAuthProvider.refresh().catch((e: unknown) => e)) as AuthError
    expect(error.code).toBe('REFRESH_FAILED')
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('clears the session when the pool rejects the refresh token', async () => {
    tokenStore.setTokens({
      accessToken: 'old',
      refreshToken: 'dead',
      expiresAt: 1,
      identity: { id: 'x', email: 'laiba@aurelia.pk', fullName: 'Laiba' },
    })
    refreshSession.mockImplementation((_token: unknown, cb: (e: unknown, s: unknown) => void) => {
      cb({ name: 'NotAuthorizedException', message: 'Refresh Token has expired' }, null)
    })

    const error = (await cognitoAuthProvider.refresh().catch((e: unknown) => e)) as AuthError

    expect(error.code).toBe('REFRESH_FAILED')
    expect(tokenStore.hasSession()).toBe(false)
  })
})

describe('cognitoAuthProvider.signOut', () => {
  it('revokes the refresh token via globalSignOut', async () => {
    tokenStore.setTokens({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: 1,
      identity: { id: 'x', email: 'laiba@aurelia.pk', fullName: 'Laiba' },
    })
    getSession.mockImplementation((cb: (e: unknown) => void) => {
      cb(null)
    })
    globalSignOut.mockImplementation((cb: { onSuccess: () => void }) => {
      cb.onSuccess()
    })

    await cognitoAuthProvider.signOut()

    // Plain signOut() only drops local SDK state; revocation is what stops a
    // captured refresh token being replayed (BR-14).
    expect(globalSignOut).toHaveBeenCalledOnce()
    expect(tokenStore.hasSession()).toBe(false)
  })

  it('still clears locally when there is no live session to revoke', async () => {
    tokenStore.setTokens({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: 1,
      identity: { id: 'x', email: 'laiba@aurelia.pk', fullName: 'Laiba' },
    })
    getSession.mockImplementation((cb: (e: unknown) => void) => {
      cb(new Error('no session'))
    })

    await cognitoAuthProvider.signOut()

    expect(globalSignOut).not.toHaveBeenCalled()
    expect(tokenStore.hasSession()).toBe(false)
  })

  it('clears local tokens even when revocation fails', async () => {
    tokenStore.setTokens({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: 1,
      identity: { id: 'x', email: 'laiba@aurelia.pk', fullName: 'Laiba' },
    })

    getSession.mockImplementation((cb: (e: unknown) => void) => {
      cb(null)
    })
    globalSignOut.mockImplementation((cb: { onFailure: () => void }) => {
      cb.onFailure()
    })

    await expect(cognitoAuthProvider.signOut()).resolves.toBeUndefined()
    expect(tokenStore.hasSession()).toBe(false)
  })

  it('clears local tokens even with no stored identity, without calling the pool', async () => {
    tokenStore.setTokens({ accessToken: 'a', refreshToken: 'r', expiresAt: 1 })

    await cognitoAuthProvider.signOut()

    expect(tokenStore.hasSession()).toBe(false)
    expect(globalSignOut).not.toHaveBeenCalled()
  })

  it('still reaches the login screen when the pool round-trip throws', async () => {
    tokenStore.setTokens({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: 1,
      identity: { id: 'x', email: 'laiba@aurelia.pk', fullName: 'Laiba' },
    })
    getSession.mockImplementation(() => {
      throw new Error('network down')
    })

    await expect(cognitoAuthProvider.signOut()).resolves.toBeUndefined()
    expect(tokenStore.hasSession()).toBe(false)
  })
})

describe('cognitoAuthProvider synchronous reads', () => {
  it('serves the access token and identity straight from the token store', () => {
    const identity = { id: 'x', email: 'laiba@aurelia.pk', fullName: 'Laiba' }
    tokenStore.setTokens({ accessToken: 'a', refreshToken: 'r', expiresAt: 1, identity })

    expect(cognitoAuthProvider.getAccessToken()).toBe('a')
    expect(cognitoAuthProvider.getIdentity()).toEqual(identity)
  })
})

describe('cognitoAuthProvider — Pre-Auth rejections', () => {
  /** Drives signIn with a given Cognito failure and returns the mapped error. */
  async function signInFailingWith(failure: { name: string; message: string }) {
    authenticateUser.mockImplementation((_d: unknown, cb: { onFailure: (e: unknown) => void }) => {
      cb.onFailure(failure)
    })
    return (await cognitoAuthProvider
      .signIn('laiba@aurelia.pk', 'pw')
      .catch((e: unknown) => e)) as AuthError
  }

  it.each([
    'Your account is temporarily locked. Try again in 15 minutes.',
    'Your account has been suspended. Please contact support.',
    'Sign-in is temporarily unavailable. Please try again shortly.',
  ])('passes the Lambda copy through untouched: %s', async (message) => {
    const error = await signInFailingWith({ name: 'NotAuthorizedException', message })

    expect(error.code).toBe('PRE_AUTH_REJECTED')
    expect(error.message).toBe(message)
  })

  it('treats a plain wrong password as a credential failure, not a rejection', async () => {
    const error = await signInFailingWith({
      name: 'NotAuthorizedException',
      message: 'Incorrect username or password.',
    })

    expect(error.code).toBe('INVALID_CREDENTIALS')
  })
})

describe('cognitoAuthProvider.forgotPassword', () => {
  it('requests a reset code', async () => {
    forgotPassword.mockImplementation((cb: { onSuccess: () => void }) => {
      cb.onSuccess()
    })

    await expect(cognitoAuthProvider.forgotPassword('laiba@aurelia.pk')).resolves.toBeUndefined()
  })

  it.each(['UserNotFoundException', 'NotAuthorizedException'])(
    'resolves on %s so account existence is never revealed',
    async (name) => {
      forgotPassword.mockImplementation((cb: { onFailure: (e: unknown) => void }) => {
        cb.onFailure({ name, message: 'nope' })
      })

      // BR-08 — an unregistered or suspended address must look identical to a
      // registered one.
      await expect(cognitoAuthProvider.forgotPassword('nobody@aurelia.pk')).resolves.toBeUndefined()
    },
  )

  it('still surfaces a rate limit, which says nothing about existence', async () => {
    forgotPassword.mockImplementation((cb: { onFailure: (e: unknown) => void }) => {
      cb.onFailure({ name: 'LimitExceededException', message: 'slow down' })
    })

    const error = (await cognitoAuthProvider
      .forgotPassword('laiba@aurelia.pk')
      .catch((e: unknown) => e)) as AuthError

    expect(error.code).toBe('LIMIT_EXCEEDED')
  })
})

describe('cognitoAuthProvider.confirmForgotPassword', () => {
  it('sets the new password', async () => {
    confirmPassword.mockImplementation(
      (_code: string, _pw: string, cb: { onSuccess: () => void }) => {
        cb.onSuccess()
      },
    )

    await expect(
      cognitoAuthProvider.confirmForgotPassword('laiba@aurelia.pk', '123456', 'aurelia1'),
    ).resolves.toBeUndefined()
  })

  it.each([
    ['CodeMismatchException', 'CODE_MISMATCH'],
    ['ExpiredCodeException', 'CODE_EXPIRED'],
    ['InvalidPasswordException', 'INVALID_PASSWORD'],
  ])('maps %s to %s', async (name, expected) => {
    confirmPassword.mockImplementation(
      (_code: string, _pw: string, cb: { onFailure: (e: unknown) => void }) => {
        cb.onFailure({ name, message: 'x' })
      },
    )

    const error = (await cognitoAuthProvider
      .confirmForgotPassword('laiba@aurelia.pk', '000000', 'aurelia1')
      .catch((e: unknown) => e)) as AuthError

    expect(error.code).toBe(expected)
  })
})

describe('cognitoAuthProvider.changePassword', () => {
  beforeEach(() => {
    tokenStore.setTokens({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: 1,
      identity: { id: 'x', email: 'laiba@aurelia.pk', fullName: 'Laiba' },
    })
    // The live session comes from a refresh, not from the SDK's own cache.
    refreshSession.mockImplementation((_token: unknown, cb: (e: unknown, s: unknown) => void) => {
      cb(null, fakeSession())
    })
  })

  it('changes the password on a live session', async () => {
    changePassword.mockImplementation((_old: string, _next: string, cb: (e: unknown) => void) => {
      cb(null)
    })

    await expect(
      cognitoAuthProvider.changePassword('Partner@123', 'aurelia1'),
    ).resolves.toBeUndefined()
    // The session is untouched — an in-app change must not sign the user out.
    expect(tokenStore.hasSession()).toBe(true)
  })

  /**
   * The regression this replaced: `getSession()` reads the SDK's localStorage
   * cache, which we never populate, so it failed before any request was made and
   * the modal showed only "Something went wrong".
   */
  it('does not depend on the SDK session cache', async () => {
    changePassword.mockImplementation((_old: string, _next: string, cb: (e: unknown) => void) => {
      cb(null)
    })

    await cognitoAuthProvider.changePassword('Partner@123', 'aurelia1')

    expect(refreshSession).toHaveBeenCalled()
    expect(getSession).not.toHaveBeenCalled()
  })

  it('reports a dead refresh token rather than attempting the change', async () => {
    refreshSession.mockImplementation((_token: unknown, cb: (e: unknown, s: unknown) => void) => {
      cb({ name: 'NotAuthorizedException', message: 'Refresh Token has expired' }, null)
    })

    const error = (await cognitoAuthProvider
      .changePassword('Partner@123', 'aurelia1')
      .catch((e: unknown) => e)) as AuthError

    expect(error.code).toBe('REFRESH_FAILED')
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('maps a wrong current password to INVALID_CREDENTIALS', async () => {
    changePassword.mockImplementation((_old: string, _next: string, cb: (e: unknown) => void) => {
      cb({ name: 'NotAuthorizedException', message: 'Incorrect username or password.' })
    })

    const error = (await cognitoAuthProvider
      .changePassword('wrong', 'aurelia1')
      .catch((e: unknown) => e)) as AuthError

    expect(error.code).toBe('INVALID_CREDENTIALS')
  })

  /**
   * MET-1290 — the pool has no password-history rule, so it would accept this
   * and report success. Nothing reaches Cognito.
   */
  it('rejects a new password identical to the current one', async () => {
    const error = (await cognitoAuthProvider
      .changePassword('Partner@123', 'Partner@123')
      .catch((e: unknown) => e)) as AuthError

    expect(error.code).toBe('SAME_PASSWORD')
    expect(refreshSession).not.toHaveBeenCalled()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('fails when there is no signed-in identity', async () => {
    tokenStore.clear()

    const error = (await cognitoAuthProvider
      .changePassword('x', 'aurelia1')
      .catch((e: unknown) => e)) as AuthError

    expect(error.code).toBe('INVALID_CREDENTIALS')
  })
})
