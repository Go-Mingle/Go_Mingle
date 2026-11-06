/**
 * FE1 puts `refreshAccessToken` on the live renewal path (BR-02) — it was dead
 * code until now, which is why this module had almost no coverage. These tests
 * cover the renewal exchange plus the login/sign-out calls and the Cognito
 * error mapping that drives the login screen's messages.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const send = vi.fn()

// Parameter properties are not allowed under `erasableSyntaxOnly`, so each
// command stub assigns its input explicitly.
class CommandStub {
  input: unknown
  constructor(input: unknown) {
    this.input = input
  }
}

vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: class {
    send = send
  },
  InitiateAuthCommand: CommandStub,
  GetUserCommand: CommandStub,
  GlobalSignOutCommand: CommandStub,
}))

const {
  cognitoLogin,
  cognitoSignOut,
  refreshAccessToken,
  shouldRefreshToken,
  mapCognitoErrorToCode,
} = await import('../cognitoService')

beforeEach(() => {
  send.mockReset()
  localStorage.clear()
})

describe('cognitoLogin', () => {
  it('stores both tokens and maps the user attributes', async () => {
    send
      .mockResolvedValueOnce({
        AuthenticationResult: { AccessToken: 'access-1', RefreshToken: 'refresh-1' },
      })
      .mockResolvedValueOnce({
        UserAttributes: [
          { Name: 'sub', Value: 'u-1' },
          { Name: 'email', Value: 'hira@gomingle.com' },
          { Name: 'name', Value: 'Hira Mansoor' },
        ],
      })

    const result = await cognitoLogin('hira@gomingle.com', 'pw')

    expect(result.accessToken).toBe('access-1')
    expect(result.user).toMatchObject({
      id: 'u-1',
      email: 'hira@gomingle.com',
      name: 'Hira Mansoor',
      initials: 'HI',
      fullAccess: false,
    })
    expect(localStorage.getItem('auth-token')).toBe('access-1')
    expect(localStorage.getItem('auth-refresh-token')).toBe('refresh-1')
  })

  it('falls back to the login email when Cognito returns no attributes', async () => {
    send
      .mockResolvedValueOnce({ AuthenticationResult: { AccessToken: 'access-2' } })
      .mockResolvedValueOnce({})

    const result = await cognitoLogin('fallback@gomingle.com', 'pw')

    expect(result.user.email).toBe('fallback@gomingle.com')
    expect(result.user.name).toBe('fallback@gomingle.com')
    expect(result.user.id).toBe('')
    // No refresh token in the response → nothing stored for it.
    expect(localStorage.getItem('auth-refresh-token')).toBeNull()
  })

  it('throws when Cognito returns no access token', async () => {
    send.mockResolvedValueOnce({ AuthenticationResult: {} })
    await expect(cognitoLogin('a@b.c', 'pw')).rejects.toThrow(
      'No access token returned from Cognito',
    )
  })
})

describe('refreshAccessToken — the FE1 renewal exchange', () => {
  it('exchanges the stored refresh token and persists the new access token', async () => {
    localStorage.setItem('auth-refresh-token', 'refresh-1')
    send.mockResolvedValueOnce({ AuthenticationResult: { AccessToken: 'access-new' } })

    await expect(refreshAccessToken()).resolves.toBe('access-new')

    expect(localStorage.getItem('auth-token')).toBe('access-new')
    expect(localStorage.getItem('auth-token-timestamp')).not.toBeNull()
    const sent = send.mock.calls[0][0] as { input: { AuthParameters: Record<string, string> } }
    expect(sent.input.AuthParameters.REFRESH_TOKEN).toBe('refresh-1')
  })

  it('throws when there is no refresh token to exchange', async () => {
    await expect(refreshAccessToken()).rejects.toThrow('No refresh token found')
    expect(send).not.toHaveBeenCalled()
  })

  it('throws when the exchange returns no access token', async () => {
    localStorage.setItem('auth-refresh-token', 'refresh-1')
    send.mockResolvedValueOnce({ AuthenticationResult: {} })

    await expect(refreshAccessToken()).rejects.toThrow(
      'No access token returned from token refresh',
    )
    expect(localStorage.getItem('auth-token')).toBeNull()
  })

  it('propagates a rejected exchange so the caller can terminate the session', async () => {
    localStorage.setItem('auth-refresh-token', 'revoked')
    send.mockRejectedValueOnce(new Error('NotAuthorizedException'))

    await expect(refreshAccessToken()).rejects.toThrow('NotAuthorizedException')
  })
})

describe('cognitoSignOut', () => {
  it('sends a global sign-out for the given access token', async () => {
    send.mockResolvedValueOnce({})
    await cognitoSignOut('access-1')

    const sent = send.mock.calls[0][0] as { input: { AccessToken: string } }
    expect(sent.input.AccessToken).toBe('access-1')
  })
})

describe('shouldRefreshToken', () => {
  it('is false without a stored timestamp', () => {
    expect(shouldRefreshToken()).toBe(false)
  })

  it('is false for a freshly issued token', () => {
    localStorage.setItem('auth-token-timestamp', Date.now().toString())
    expect(shouldRefreshToken()).toBe(false)
  })

  it('is true once the token is within the refresh threshold', () => {
    // Issued 1h59m ago — under the 5-minute threshold of the 2h lifetime.
    localStorage.setItem('auth-token-timestamp', (Date.now() - 119 * 60 * 1000).toString())
    expect(shouldRefreshToken()).toBe(true)
  })
})

describe('mapCognitoErrorToCode', () => {
  const byName: [string, string][] = [
    ['InvalidPasswordException', 'ERR_INVALID_PASSWORD'],
    ['PasswordResetRequiredException', 'ERR_PASSWORD_RESET_REQUIRED'],
    ['UserNotConfirmedException', 'ERR_USER_NOT_CONFIRMED'],
    ['UserNotFoundException', 'ERR_USER_NOT_FOUND'],
    ['UsernameExistsException', 'ERR_USER_ALREADY_EXISTS'],
    ['UserLambdaValidationException', 'ERR_ACCOUNT_LOCKED'],
    ['TooManyRequestsException', 'ERR_TOO_MANY_ATTEMPTS'],
    ['NotAuthorizedException', 'ERR_INVALID_CREDENTIALS'],
    ['NetworkingError', 'ERR_COGNITO_UNAVAILABLE'],
    ['TimeoutError', 'ERR_COGNITO_UNAVAILABLE'],
  ]

  it.each(byName)('maps the %s error name to %s', (name, expected) => {
    const err = new Error('boom')
    err.name = name
    expect(mapCognitoErrorToCode(err)).toBe(expected)
  })

  const byMessage: [string, string][] = [
    ['InvalidPasswordException happened', 'ERR_INVALID_PASSWORD'],
    ['PasswordResetRequired for user', 'ERR_PASSWORD_RESET_REQUIRED'],
    ['UserNotConfirmedException here', 'ERR_USER_NOT_CONFIRMED'],
    ['UserNotFoundException here', 'ERR_USER_NOT_FOUND'],
    ['UsernameExistsException here', 'ERR_USER_ALREADY_EXISTS'],
    ['UserLambdaValidationException here', 'ERR_ACCOUNT_LOCKED'],
    ['TooManyRequestsException here', 'ERR_TOO_MANY_ATTEMPTS'],
    ['NotAuthorizedException here', 'ERR_INVALID_CREDENTIALS'],
    ['Invalid credentials supplied', 'ERR_INVALID_CREDENTIALS'],
    ['something invalid', 'ERR_INVALID_CREDENTIALS'],
    ['NetworkingError occurred', 'ERR_COGNITO_UNAVAILABLE'],
    ['TimeoutError occurred', 'ERR_COGNITO_UNAVAILABLE'],
  ]

  it.each(byMessage)('maps the message %j to %s', (message, expected) => {
    expect(mapCognitoErrorToCode(new Error(message))).toBe(expected)
  })

  it('falls back to a generic code for an unrecognised error', () => {
    expect(mapCognitoErrorToCode(new Error('something else entirely'))).toBe(
      'ERR_AUTHENTICATION_FAILED',
    )
  })

  it('handles a non-Error value', () => {
    expect(mapCognitoErrorToCode('NetworkingError')).toBe('ERR_COGNITO_UNAVAILABLE')
    expect(mapCognitoErrorToCode(null)).toBe('ERR_AUTHENTICATION_FAILED')
  })
})
