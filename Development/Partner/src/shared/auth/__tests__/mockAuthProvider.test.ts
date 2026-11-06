import { describe, it, expect, vi, afterEach } from 'vitest'
import { AuthError } from '../authError'
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  MOCK_LOCK_AFTER_FAILURES,
  MOCK_LOCK_DURATION_MS,
  MOCK_RESET_CODE,
  mockAuthProvider,
  rememberMockSignup,
} from '../mockAuthProvider'
import { tokenStore } from '../tokenStore'

describe('mockAuthProvider', () => {
  it('signs in the demo partner and stores real-shaped tokens', async () => {
    const identity = await mockAuthProvider.signIn(DEMO_EMAIL, DEMO_PASSWORD)

    expect(identity).toMatchObject({ id: 'u1', email: DEMO_EMAIL, fullName: 'Hira Mansoor' })
    expect(tokenStore.getAccessToken()).toMatch(/^mock-access-/)
    expect(tokenStore.getRefreshToken()).toMatch(/^mock-refresh-/)
    expect(tokenStore.getExpiresAt()).toBeGreaterThan(Date.now())
    expect(mockAuthProvider.getAccessToken()).toBe(tokenStore.getAccessToken())
    expect(mockAuthProvider.getIdentity()).toEqual(identity)
  })

  it('rejects a wrong password with INVALID_CREDENTIALS and stores nothing', async () => {
    const error = await mockAuthProvider.signIn(DEMO_EMAIL, 'wrong').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(AuthError)
    expect((error as AuthError).code).toBe('INVALID_CREDENTIALS')
    expect(tokenStore.hasSession()).toBe(false)
  })

  it('rejects an unknown email', async () => {
    const error = await mockAuthProvider
      .signIn('someone@else.com', DEMO_PASSWORD)
      .catch((e: unknown) => e)

    expect((error as AuthError).code).toBe('INVALID_CREDENTIALS')
  })

  it('issues a new access token on refresh and keeps the refresh token', async () => {
    await mockAuthProvider.signIn(DEMO_EMAIL, DEMO_PASSWORD)
    const before = tokenStore.getAccessToken()
    const refreshToken = tokenStore.getRefreshToken()

    const next = await mockAuthProvider.refresh()

    expect(next).toBe(tokenStore.getAccessToken())
    expect(tokenStore.getRefreshToken()).toBe(refreshToken)
    expect(before).not.toBeNull()
  })

  it('fails the refresh when there is no refresh token', async () => {
    const error = await mockAuthProvider.refresh().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(AuthError)
    expect((error as AuthError).code).toBe('REFRESH_FAILED')
  })

  it('signs in a partner the mock backend just created', async () => {
    // Signup is backend-orchestrated (CR-51), so the MSW complete handler
    // registers the partner rather than the provider creating them. Without
    // this, signing out after signup would dead-end on /login.
    rememberMockSignup('new@aurelia.pk', 'aurelia1')

    const identity = await mockAuthProvider.signIn('new@aurelia.pk', 'aurelia1')

    expect(identity.email).toBe('new@aurelia.pk')
    expect(tokenStore.hasSession()).toBe(true)
  })

  it('matches the registered email case-insensitively', async () => {
    rememberMockSignup('New@Aurelia.pk', 'aurelia1')

    await expect(mockAuthProvider.signIn('new@aurelia.pk', 'aurelia1')).resolves.toMatchObject({
      email: 'new@aurelia.pk',
    })
  })

  it('ignores a registration whose password fails the policy', async () => {
    rememberMockSignup('new@aurelia.pk', 'short')

    const error = (await mockAuthProvider
      .signIn('new@aurelia.pk', 'short')
      .catch((e: unknown) => e)) as AuthError

    expect(error.code).toBe('INVALID_CREDENTIALS')
  })

  it('rejects an email that never signed up', async () => {
    const error = (await mockAuthProvider
      .signIn('stranger@aurelia.pk', 'aurelia1')
      .catch((e: unknown) => e)) as AuthError

    expect(error.code).toBe('INVALID_CREDENTIALS')
  })

  it('clears the session on sign-out', async () => {
    await mockAuthProvider.signIn(DEMO_EMAIL, DEMO_PASSWORD)
    await mockAuthProvider.signOut()

    expect(tokenStore.hasSession()).toBe(false)
    expect(mockAuthProvider.getAccessToken()).toBeNull()
    expect(mockAuthProvider.getIdentity()).toBeNull()
  })
})

describe('mockAuthProvider — J2 password flows', () => {
  it('never rejects forgotPassword, even for an unknown address', async () => {
    // Enumeration-safe: the UI must show the same confirmation either way.
    await expect(mockAuthProvider.forgotPassword('nobody@aurelia.pk')).resolves.toBeUndefined()
  })

  it('resets the password with the issued code and allows sign-in after', async () => {
    await mockAuthProvider.forgotPassword('reset@aurelia.pk')

    await expect(
      mockAuthProvider.confirmForgotPassword('reset@aurelia.pk', MOCK_RESET_CODE, 'aurelia1'),
    ).resolves.toBeUndefined()
    await expect(mockAuthProvider.signIn('reset@aurelia.pk', 'aurelia1')).resolves.toMatchObject({
      email: 'reset@aurelia.pk',
    })
  })

  it('rejects a wrong reset code', async () => {
    await mockAuthProvider.forgotPassword('reset@aurelia.pk')

    const error = (await mockAuthProvider
      .confirmForgotPassword('reset@aurelia.pk', '000000', 'aurelia1')
      .catch((e: unknown) => e)) as AuthError

    expect(error.code).toBe('CODE_MISMATCH')
  })

  it('rejects a reset password that fails the policy', async () => {
    await mockAuthProvider.forgotPassword('reset@aurelia.pk')

    const error = (await mockAuthProvider
      .confirmForgotPassword('reset@aurelia.pk', MOCK_RESET_CODE, 'short')
      .catch((e: unknown) => e)) as AuthError

    expect(error.code).toBe('INVALID_PASSWORD')
  })

  it('treats a reset with no issued code as expired', async () => {
    const error = (await mockAuthProvider
      .confirmForgotPassword('never-asked@aurelia.pk', MOCK_RESET_CODE, 'aurelia1')
      .catch((e: unknown) => e)) as AuthError

    expect(error.code).toBe('CODE_EXPIRED')
  })

  it('changes the demo partner password with the correct current one', async () => {
    await mockAuthProvider.signIn(DEMO_EMAIL, DEMO_PASSWORD)

    await expect(
      mockAuthProvider.changePassword(DEMO_PASSWORD, 'aurelia1'),
    ).resolves.toBeUndefined()
  })

  it('rejects a wrong current password', async () => {
    await mockAuthProvider.signIn(DEMO_EMAIL, DEMO_PASSWORD)

    const error = (await mockAuthProvider
      .changePassword('nope', 'aurelia1')
      .catch((e: unknown) => e)) as AuthError

    expect(error.code).toBe('INVALID_CREDENTIALS')
  })

  it('rejects a new password that fails the policy', async () => {
    await mockAuthProvider.signIn(DEMO_EMAIL, DEMO_PASSWORD)

    const error = (await mockAuthProvider
      .changePassword(DEMO_PASSWORD, 'short')
      .catch((e: unknown) => e)) as AuthError

    expect(error.code).toBe('INVALID_PASSWORD')
  })

  // MET-1290 — reusing the current password is a no-op, not a change.
  it('rejects a new password identical to the current one', async () => {
    await mockAuthProvider.signIn(DEMO_EMAIL, DEMO_PASSWORD)

    const error = (await mockAuthProvider
      .changePassword(DEMO_PASSWORD, DEMO_PASSWORD)
      .catch((e: unknown) => e)) as AuthError

    expect(error.code).toBe('SAME_PASSWORD')
  })

  it('requires a session to change the password', async () => {
    const error = (await mockAuthProvider
      .changePassword('x', 'aurelia1')
      .catch((e: unknown) => e)) as AuthError

    expect(error.code).toBe('REFRESH_FAILED')
  })
})

/**
 * MET-1240 — BR-02 lockout, the mock standing in for the Pre-Auth Lambda.
 *
 * These are the four cases the ticket left blocked (TC-PARTNER-AUTH-008, 009,
 * 010, 036). They assert what the *partner sees* on a rejection the server
 * authored — never a client-side counter, which is why nothing here reads
 * storage. `localStorage['auth-lockout']` has no meaning in any build and the
 * login tests assert it stays untouched.
 */
describe('mockAuthProvider — J2 BR-02 lockout (MET-1240)', () => {
  const VICTIM = 'locked@aurelia.pk'

  /** Moves the clock without fake timers, which `signIn`'s latency needs real. */
  function travel(ms: number): void {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + ms)
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * `nope` fails the password policy, which matters: a *registered* address
   * accepts any policy-valid password (the mock cannot know the one the backend
   * set), so a policy-valid "wrong" password would sign in instead of failing.
   */
  const failSignIn = async (email: string, password = 'nope'): Promise<AuthError> =>
    (await mockAuthProvider.signIn(email, password).catch((e: unknown) => e)) as AuthError

  /** Drives the account to the threshold and returns the 5th rejection. */
  const lockOut = async (email: string): Promise<AuthError> => {
    let last = new AuthError('UNKNOWN')
    for (let attempt = 0; attempt < MOCK_LOCK_AFTER_FAILURES; attempt += 1) {
      last = await failSignIn(email)
    }
    return last
  }

  // TC-008 / AC-01.3
  it('locks on the 5th consecutive failure and names the remaining time', async () => {
    for (let attempt = 0; attempt < MOCK_LOCK_AFTER_FAILURES - 1; attempt += 1) {
      const early = await failSignIn(VICTIM)
      // Below the threshold the copy must not hint at how many are left (BR-04).
      expect(early.code).toBe('INVALID_CREDENTIALS')
    }

    const fifth = await failSignIn(VICTIM)

    expect(fifth.code).toBe('PRE_AUTH_REJECTED')
    expect(fifth.message).toBe('Your account is temporarily locked. Try again in 15 minutes.')
  })

  // TC-009 / AC-01.4
  it('rejects the correct password while locked, without issuing a session', async () => {
    rememberMockSignup(VICTIM, 'aurelia1')
    await lockOut(VICTIM)

    const rejection = await failSignIn(VICTIM, 'aurelia1')

    expect(rejection.code).toBe('PRE_AUTH_REJECTED')
    expect(tokenStore.hasSession()).toBe(false)
  })

  // TC-009 — the lock is flat: attempting during it does not push it out.
  it('does not extend the lock, and counts the remaining time down', async () => {
    await lockOut(VICTIM)

    travel(5 * 60_000)
    const during = await failSignIn(VICTIM)
    const again = await failSignIn(VICTIM)

    expect(during.message).toBe('Your account is temporarily locked. Try again in 10 minutes.')
    expect(again.message).toBe(during.message)
  })

  it('says "1 minute" in the singular on the last minute of the lock', async () => {
    await lockOut(VICTIM)

    travel(MOCK_LOCK_DURATION_MS - 60_000)

    expect((await failSignIn(VICTIM)).message).toBe(
      'Your account is temporarily locked. Try again in 1 minute.',
    )
  })

  // TC-010 / AC-01.5
  it('auto-expires the lock after 15 minutes and accepts the right password', async () => {
    rememberMockSignup(VICTIM, 'aurelia1')
    await lockOut(VICTIM)

    travel(MOCK_LOCK_DURATION_MS)

    await expect(mockAuthProvider.signIn(VICTIM, 'aurelia1')).resolves.toMatchObject({
      email: VICTIM,
    })
  })

  // TC-036 / AC-003 — the rule is *consecutive* failures.
  it('resets the counter on a success, so 4 + success + 4 does not lock', async () => {
    for (let attempt = 0; attempt < MOCK_LOCK_AFTER_FAILURES - 1; attempt += 1) {
      await failSignIn(DEMO_EMAIL)
    }
    await mockAuthProvider.signIn(DEMO_EMAIL, DEMO_PASSWORD)

    let last = new AuthError('UNKNOWN')
    for (let attempt = 0; attempt < MOCK_LOCK_AFTER_FAILURES - 1; attempt += 1) {
      last = await failSignIn(DEMO_EMAIL)
    }

    expect(last.code).toBe('INVALID_CREDENTIALS')
  })

  it('locks the account, not the browser — another address still signs in', async () => {
    await lockOut(VICTIM)

    await expect(mockAuthProvider.signIn(DEMO_EMAIL, DEMO_PASSWORD)).resolves.toMatchObject({
      email: DEMO_EMAIL,
    })
  })

  it('keys the lock case-insensitively, like the address it stands for', async () => {
    await lockOut(VICTIM.toUpperCase())

    expect((await failSignIn(VICTIM)).code).toBe('PRE_AUTH_REJECTED')
  })
})
