import { AuthError } from './authError'
import { tokenStore } from './tokenStore'
import { meetsPasswordPolicy } from '../utils/passwordStrength'
import type { AuthIdentity, PartnerAuthProvider } from './types'

/** The demo partner. Kept here so the prototype login keeps working unchanged. */
export const DEMO_EMAIL = 'partner@gomingle.com'
export const DEMO_PASSWORD = 'Partner@123'

const DEMO_IDENTITY: AuthIdentity = {
  id: 'u1',
  email: DEMO_EMAIL,
  fullName: 'Hira Mansoor',
}

const SIGN_IN_LATENCY_MS = 800
const SIGN_UP_LATENCY_MS = 400
const TWO_HOURS_MS = 2 * 60 * 60 * 1000

const normalise = (email: string) => email.trim().toLowerCase()

/**
 * Emails that completed the mock `SignUp`.
 *
 * The real flow sets the password server-side via `AdminSetUserPassword`, so
 * the client never learns it — the mock therefore accepts any policy-valid
 * password for an email that signed up, which is as close as it can get
 * without a pool. Without this, the step-5 auto-login would reject every
 * freshly created account and the demo signup would dead-end on /login.
 */
const signedUpEmails = new Set<string>()

/** Addresses the mock has "emailed" a reset code to. */
const resetCodeIssuedTo = new Set<string>()

/** The reset code the mock accepts; anything else exercises the mismatch path. */
export const MOCK_RESET_CODE = '123456'

/**
 * MET-1240 — the mock's stand-in for the Partners-pool Pre-Authentication
 * Lambda (J2 BR-02, CR-019).
 *
 * Lockout is *not* a client-side rule and must never become one: a counter the
 * browser owns is cleared by clearing a key. The real gate is the Lambda, which
 * holds `auth:fail:{sub}` and `auth:lock:{sub}` in Redis and rejects the attempt
 * before the password is checked. This lives here, on the far side of the auth
 * seam, for the same reason the mock accepts any policy-valid password for a
 * registered email: it is the fake server, not enforcement. Everything above
 * `getAuthProvider()` runs its production path — it receives a
 * `PRE_AUTH_REJECTED` it did not compute and shows the copy verbatim.
 *
 * Consequently the copy is deliberately untranslated. The Lambda authors it
 * server-side, so `t()` would be wrong: there is nothing for the client to
 * localise, and pretending otherwise is what produces an attempts-remaining
 * hint the server never sent.
 */
export const MOCK_LOCK_AFTER_FAILURES = 5
export const MOCK_LOCK_DURATION_MS = 15 * 60 * 1000

/** Consecutive failures per address — the mock's `auth:fail:{sub}`. */
const failureCounts = new Map<string, number>()
/** Lock expiry per address — the mock's `auth:lock:{sub}` (existence = locked). */
const lockExpiries = new Map<string, number>()

/** Names the remaining time, as AC-01.3/AC-01.4 require of the lock message. */
function lockMessage(msRemaining: number): string {
  // Only ever called with a positive remainder, so the ceiling is at least 1.
  const minutes = Math.ceil(msRemaining / 60_000)
  return `Your account is temporarily locked. Try again in ${String(minutes)} minute${
    minutes === 1 ? '' : 's'
  }.`
}

/**
 * The lock check, run before credentials are looked at.
 *
 * Returns the rejection to throw, or null to proceed. An expired lock is
 * cleared here rather than on a timer — the real one auto-expires with its
 * Redis TTL, so nothing sweeps it (AC-01.5).
 */
function activeLockRejection(address: string): AuthError | null {
  const expiry = lockExpiries.get(address)
  if (expiry === undefined) return null
  const remaining = expiry - Date.now()
  if (remaining <= 0) {
    lockExpiries.delete(address)
    return null
  }
  // Attempts during the lock do not extend it (AC-01.4).
  return new AuthError('PRE_AUTH_REJECTED', lockMessage(remaining))
}

/** Counts the failure and locks on the 5th, mirroring CR-019 §2.2 step 3. */
function recordFailure(address: string): AuthError {
  const failures = (failureCounts.get(address) ?? 0) + 1
  if (failures < MOCK_LOCK_AFTER_FAILURES) {
    failureCounts.set(address, failures)
    return new AuthError('INVALID_CREDENTIALS')
  }
  // At the threshold the counter is dropped and the lock takes over, so the
  // rule counts *consecutive* failures.
  failureCounts.delete(address)
  lockExpiries.set(address, Date.now() + MOCK_LOCK_DURATION_MS)
  return new AuthError('PRE_AUTH_REJECTED', lockMessage(MOCK_LOCK_DURATION_MS))
}

/**
 * Records a partner the mock backend just created, so signing out and back in
 * works in the demo. Signup itself is backend-orchestrated (CR-51), so the MSW
 * `complete` handler calls this rather than the provider creating the user.
 */
export function rememberMockSignup(email: string, password: string): void {
  if (meetsPasswordPolicy(password)) signedUpEmails.add(normalise(email))
}

/** Test-only — all of this is module state that outlives a test file. */
export function __resetMockAuthState(): void {
  signedUpEmails.clear()
  resetCodeIssuedTo.clear()
  failureCounts.clear()
  lockExpiries.clear()
}

function issueSession(identity: AuthIdentity): AuthIdentity {
  tokenStore.setTokens({
    accessToken: `mock-access-${String(Date.now())}`,
    refreshToken: `mock-refresh-${String(Date.now())}`,
    expiresAt: Date.now() + TWO_HOURS_MS,
    identity,
  })
  return identity
}

/**
 * Stands in for Cognito until DevOps provisions the GoMingle-Partners pool.
 *
 * It issues structurally real tokens into the same {@link tokenStore} the
 * Cognito adapter uses, so every layer above the seam — the Bearer header, the
 * refresh-and-retry path, the session query — runs its production code path
 * against MSW.
 */
export const mockAuthProvider: PartnerAuthProvider = {
  signIn: async (email: string, password: string): Promise<AuthIdentity> => {
    await new Promise((resolve) => setTimeout(resolve, SIGN_IN_LATENCY_MS))

    const address = normalise(email)

    // Before the credentials, exactly as the Pre-Auth Lambda runs before
    // Cognito verifies the password — a locked account is rejected however
    // right the password is (AC-01.4).
    const locked = activeLockRejection(address)
    if (locked) throw locked

    const authenticated =
      (address === DEMO_EMAIL && password === DEMO_PASSWORD) ||
      // A partner who just completed signup — the mock cannot know the password
      // the backend set, so any policy-valid one is accepted.
      (signedUpEmails.has(address) && meetsPasswordPolicy(password))

    if (!authenticated) throw recordFailure(address)

    // Post-Authentication: success clears the counter and any lock (AC-01.5).
    failureCounts.delete(address)
    lockExpiries.delete(address)

    if (address === DEMO_EMAIL) return issueSession({ ...DEMO_IDENTITY, email: address })
    return issueSession({
      id: `pu-${address}`,
      email: address,
      fullName: address.split('@')[0],
    })
  },

  getAccessToken: (): string | null => tokenStore.getAccessToken(),

  refresh: async (): Promise<string> => {
    const refreshToken = tokenStore.getRefreshToken()
    if (!refreshToken) throw new AuthError('REFRESH_FAILED')

    const accessToken = `mock-access-${String(Date.now())}`
    tokenStore.setAccessToken(accessToken, Date.now() + TWO_HOURS_MS)
    return accessToken
  },

  signOut: (): Promise<void> => {
    tokenStore.clear()
    return Promise.resolve()
  },

  getIdentity: (): AuthIdentity | null => tokenStore.getIdentity(),

  forgotPassword: async (email: string): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, SIGN_UP_LATENCY_MS))
    // Never rejects for an unknown address — enumeration-safe, like the real one.
    resetCodeIssuedTo.add(normalise(email))
  },

  confirmForgotPassword: async (
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, SIGN_UP_LATENCY_MS))

    if (code !== MOCK_RESET_CODE) throw new AuthError('CODE_MISMATCH')
    if (!meetsPasswordPolicy(newPassword)) throw new AuthError('INVALID_PASSWORD')

    const address = normalise(email)
    if (!resetCodeIssuedTo.has(address)) throw new AuthError('CODE_EXPIRED')
    // The partner can now sign in with the new password.
    signedUpEmails.add(address)
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, SIGN_UP_LATENCY_MS))

    const identity = tokenStore.getIdentity()
    if (!identity) throw new AuthError('REFRESH_FAILED')
    // Only the demo partner has a password the mock actually knows.
    const known = identity.email === DEMO_EMAIL ? DEMO_PASSWORD : null
    if (known !== null && currentPassword !== known) {
      throw new AuthError('INVALID_CREDENTIALS')
    }
    if (!meetsPasswordPolicy(newPassword)) throw new AuthError('INVALID_PASSWORD')
    // MET-1290 — reusing the current password is not a change. Enforced here as
    // well as in the modal so no caller can spend the change on a no-op.
    if (newPassword === currentPassword) throw new AuthError('SAME_PASSWORD')
  },
}
