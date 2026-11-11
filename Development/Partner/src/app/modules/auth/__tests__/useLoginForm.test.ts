import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Store } from '@reduxjs/toolkit'
import {
  AllProviders,
  makeQueryClient,
  makeStore,
} from '../../../../test-utils/renderWithProviders'
import { AuthError } from '../../../../shared/auth/authError'
import { setAuthProvider } from '../../../../shared/auth/authProvider'
import type { PartnerAuthProvider } from '../../../../shared/auth/types'
import { http } from 'msw'
import { server } from '../../../../mocks/server'
import { sessionResponses } from '../../../../mocks/data/partnerSession'
import { PARTNER_SESSION_QUERY_KEY, SESSION_ENDPOINTS } from '../../session/constants'
import { useLoginForm } from '../hooks/useLoginForm'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const EMAIL = 'hira@aurelia.pk'
const PASSWORD = 'Partner@123'

let provider: {
  signIn: ReturnType<typeof vi.fn>
  forgotPassword: ReturnType<typeof vi.fn>
  confirmForgotPassword: ReturnType<typeof vi.fn>
}

function renderLoginForm(store: Store = makeStore()) {
  return renderHook(() => useLoginForm(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { store, children }),
  })
}

/** Arrives at `/login` the way a redirecting flow leaves it — with router state. */
function renderAfterRedirect(state: unknown) {
  return renderHook(() => useLoginForm(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { routes: [{ pathname: '/login', state }], children }),
  })
}

beforeEach(() => {
  navigateMock.mockClear()
  provider = {
    signIn: vi.fn().mockResolvedValue({ id: 'pu1', email: EMAIL, fullName: 'Hira Mansoor' }),
    forgotPassword: vi.fn().mockResolvedValue(undefined),
    confirmForgotPassword: vi.fn().mockResolvedValue(undefined),
  }
  setAuthProvider({
    ...provider,
    getAccessToken: () => null,
    refresh: vi.fn(),
    signOut: vi.fn(),
    getIdentity: () => null,
    signUp: vi.fn(),
    resendSignUpCode: vi.fn(),
    changePassword: vi.fn(),
  } as unknown as PartnerAuthProvider)
})

afterEach(() => {
  setAuthProvider(null)
  vi.useRealTimers()
})

describe('useLoginForm — sign in', () => {
  it('starts on the login step', () => {
    const { result } = renderLoginForm()
    expect(result.current.step).toBe('login')
    expect(result.current.loading).toBe(false)
    expect(result.current.loginError).toBe('')
  })

  describe('a redirect notice from another flow (MET-1283)', () => {
    it('shows it in the login banner on the first render', () => {
      const { result } = renderAfterRedirect({
        authNotice: 'This account already exists. Please sign in.',
      })

      // Seeded, not set by an effect: the partner was redirected mid-signup, so
      // there must be no frame of an unexplained login screen.
      expect(result.current.loginError).toBe('This account already exists. Please sign in.')
    })

    it('clears it from router state so a reload does not replay it', async () => {
      renderAfterRedirect({ authNotice: 'This account already exists. Please sign in.' })

      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true, state: null })
      })
    })

    it.each([
      ['no state at all', null],
      ['an unrelated state object', { from: '/bookings' }],
      ['a non-string notice', { authNotice: 42 }],
    ])('leaves the banner empty for %s', (_label, state) => {
      const { result } = renderAfterRedirect(state)
      expect(result.current.loginError).toBe('')
      expect(navigateMock).not.toHaveBeenCalled()
    })
  })

  it('signs in, stores the session and navigates to the resolver', async () => {
    const store = makeStore()
    const { result } = renderLoginForm(store)

    await act(async () => {
      await result.current.onFinish({ email: `  ${EMAIL}  `, password: PASSWORD })
    })

    // Trimmed before it reaches Cognito.
    expect(provider.signIn).toHaveBeenCalledExactlyOnceWith(EMAIL, PASSWORD)
    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true })
    const state = store.getState() as {
      auth: { isAuthenticated: boolean; user: { email: string; initials: string } | null }
    }
    expect(state.auth.isAuthenticated).toBe(true)
    expect(state.auth.user?.email).toBe(EMAIL)
    expect(state.auth.user?.initials).toBe('HM')
  })

  /**
   * MET-1305 — signing in as restaurant B must not inherit restaurant A's
   * cache. Sign-out clears it too; this is the backstop for the paths that
   * reach /login without it (a session-lost teardown, a sign-out in another
   * tab).
   */
  it('starts the new identity on an empty query cache', async () => {
    const queryClient = makeQueryClient()
    queryClient.setQueryData(PARTNER_SESSION_QUERY_KEY, {
      restaurant: { id: 'rest-a', name: 'Restaurant A' },
    })
    queryClient.setQueryData(['partner', 'users'], [{ id: 'pu1' }])
    const { result } = renderHook(() => useLoginForm(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(AllProviders, { queryClient, children }),
    })

    await act(async () => {
      await result.current.onFinish({ email: EMAIL, password: PASSWORD })
    })

    // Removed outright, not invalidated: invalidation keeps the stale value, so
    // SessionBoundary would paint restaurant A for a frame before B arrives.
    expect(queryClient.getQueryData(PARTNER_SESSION_QUERY_KEY)).toBeUndefined()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('leaves the cache alone when the sign-in is rejected', async () => {
    provider.signIn.mockRejectedValue(new AuthError('INVALID_CREDENTIALS'))
    const queryClient = makeQueryClient()
    queryClient.setQueryData(PARTNER_SESSION_QUERY_KEY, {
      restaurant: { id: 'rest-a', name: 'Restaurant A' },
    })
    const { result } = renderHook(() => useLoginForm(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(AllProviders, { queryClient, children }),
    })

    await act(async () => {
      await result.current.onFinish({ email: EMAIL, password: 'wrong' })
    })

    // A failed attempt is not an identity change — the partner is still whoever
    // they were, and tearing down their cache would be a pointless refetch.
    expect(queryClient.getQueryData(PARTNER_SESSION_QUERY_KEY)).toBeDefined()
  })

  it('records the login once, without blocking the redirect', async () => {
    let recorded = 0
    server.use(
      http.post(SESSION_ENDPOINTS.loginRecorded, () => {
        recorded += 1
        return sessionResponses.loginRecorded()
      }),
    )
    const { result } = renderLoginForm()

    await act(async () => {
      await result.current.onFinish({ email: EMAIL, password: PASSWORD })
    })

    // Navigation does not wait on it (J2 BR-16).
    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true })
    await vi.waitFor(() => {
      expect(recorded).toBe(1)
    })
  })

  it('still enters the portal when recording the login fails', async () => {
    server.use(http.post(SESSION_ENDPOINTS.loginRecorded, sessionResponses.internal))
    const store = makeStore()
    const { result } = renderLoginForm(store)

    await act(async () => {
      await result.current.onFinish({ email: EMAIL, password: PASSWORD })
    })

    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true })
    const state = store.getState() as { auth: { isAuthenticated: boolean } }
    expect(state.auth.isAuthenticated).toBe(true)
  })

  it('rejects a malformed email without calling Cognito', async () => {
    const { result } = renderLoginForm()

    await act(async () => {
      await result.current.onFinish({ email: 'not-an-email', password: PASSWORD })
    })

    expect(result.current.loginError).toBe('Enter a valid email address.')
    expect(provider.signIn).not.toHaveBeenCalled()
  })

  it('requires a password', async () => {
    const { result } = renderLoginForm()

    await act(async () => {
      await result.current.onFinish({ email: EMAIL, password: '' })
    })

    expect(result.current.loginError).toBe('Password is required.')
    expect(provider.signIn).not.toHaveBeenCalled()
  })

  it('shows one generic message for a wrong password', async () => {
    provider.signIn.mockRejectedValue(new AuthError('INVALID_CREDENTIALS'))
    const { result } = renderLoginForm()

    await act(async () => {
      await result.current.onFinish({ email: EMAIL, password: 'wrong' })
    })

    expect(result.current.loginError).toBe('Email or password is incorrect.')
  })

  it('shows the same generic message for an unknown email — no enumeration', async () => {
    provider.signIn.mockRejectedValue(new AuthError('USER_NOT_FOUND'))
    const { result } = renderLoginForm()

    await act(async () => {
      await result.current.onFinish({ email: 'nobody@aurelia.pk', password: PASSWORD })
    })

    expect(result.current.loginError).toBe('Email or password is incorrect.')
  })

  it('never derives an attempts-remaining hint across repeated failures', async () => {
    provider.signIn.mockRejectedValue(new AuthError('INVALID_CREDENTIALS'))
    const { result } = renderLoginForm()

    for (let i = 0; i < 6; i += 1) {
      await act(async () => {
        await result.current.onFinish({ email: EMAIL, password: 'wrong' })
      })
    }

    // Suspension rejections do not increment the Pre-Auth counter, so any
    // client-side count would be wrong. The copy must stay constant, and no
    // lockout state may be persisted locally.
    expect(result.current.loginError).toBe('Email or password is incorrect.')
    expect(localStorage.getItem('auth-lockout')).toBeNull()
  })

  it.each([
    ['Your account is temporarily locked. Try again in 15 minutes.'],
    ['Your account has been suspended. Please contact support.'],
    ['Sign-in is temporarily unavailable. Please try again shortly.'],
  ])('shows the Pre-Auth rejection %# verbatim', async (copy) => {
    provider.signIn.mockRejectedValue(new AuthError('PRE_AUTH_REJECTED', copy))
    const { result } = renderLoginForm()

    await act(async () => {
      await result.current.onFinish({ email: EMAIL, password: PASSWORD })
    })

    expect(result.current.loginError).toBe(copy)
  })

  it('falls back to generic copy for a Pre-Auth rejection with no message', async () => {
    provider.signIn.mockRejectedValue(new AuthError('PRE_AUTH_REJECTED', ''))
    const { result } = renderLoginForm()

    await act(async () => {
      await result.current.onFinish({ email: EMAIL, password: PASSWORD })
    })

    expect(result.current.loginError).toBe('Something went wrong. Please try again.')
  })

  it('shows retry copy when Cognito rate-limits the attempt', async () => {
    provider.signIn.mockRejectedValue(new AuthError('LIMIT_EXCEEDED'))
    const { result } = renderLoginForm()

    await act(async () => {
      await result.current.onFinish({ email: EMAIL, password: PASSWORD })
    })

    expect(result.current.loginError).toBe(
      'Sign-in is temporarily unavailable. Please try again shortly.',
    )
  })

  it('falls back to generic copy for a non-AuthError failure', async () => {
    provider.signIn.mockRejectedValue(new Error('boom'))
    const { result } = renderLoginForm()

    await act(async () => {
      await result.current.onFinish({ email: EMAIL, password: PASSWORD })
    })

    expect(result.current.loginError).toBe('Something went wrong. Please try again.')
  })

  it.each([
    [
      'PASSWORD_RESET_REQUIRED',
      'You need to reset your password before signing in. Use "Forgot password?" below.',
    ],
    ['NETWORK', 'Cannot reach the server. Check your connection and try again.'],
    ['CONFIG_ERROR', 'Sign-in is temporarily unavailable. Please try again shortly.'],
    ['INVALID_EMAIL', 'Sign-in is temporarily unavailable. Please try again shortly.'],
  ] as const)(
    'gives actionable copy for %s rather than a bare generic error',
    async (code, copy) => {
      // These all previously fell through to "Something went wrong", which left a
      // misconfigured app client indistinguishable from a wrong password.
      provider.signIn.mockRejectedValue(new AuthError(code))
      const { result } = renderLoginForm()

      await act(async () => {
        await result.current.onFinish({ email: EMAIL, password: PASSWORD })
      })

      expect(result.current.loginError).toBe(copy)
    },
  )

  it('shows the demo box only while the mock provider is active', () => {
    // The suite pins the pool ids empty, so Cognito is unconfigured here.
    const { result } = renderLoginForm()
    expect(result.current.showDemoCredentials).toBe(true)
  })

  it('never shows the demo box in a built portal, unless a demo build asks for it', () => {
    vi.stubEnv('DEV', false)
    try {
      expect(renderLoginForm().result.current.showDemoCredentials).toBe(false)
      vi.stubEnv('VITE_SHOW_DEMO_CREDENTIALS', 'true')
      expect(renderLoginForm().result.current.showDemoCredentials).toBe(true)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('useLoginForm — forgot password', () => {
  it('carries the typed email into the reset step', () => {
    const { result } = renderLoginForm()

    act(() => {
      result.current.form.setFieldsValue({ email: EMAIL })
    })
    act(() => {
      result.current.handleForgotPassword()
    })

    expect(result.current.step).toBe('request-otp')
    expect(result.current.resetEmail).toBe(EMAIL)
  })

  it('validates the email before requesting a code', async () => {
    const { result } = renderLoginForm()

    act(() => {
      result.current.setResetEmail('nope')
    })
    await act(async () => {
      await result.current.handleSendOtp()
    })

    expect(result.current.resetError).toBe('Enter a valid email address.')
    expect(provider.forgotPassword).not.toHaveBeenCalled()
  })

  it('advances to the code step and starts the cooldown', async () => {
    const { result } = renderLoginForm()

    act(() => {
      result.current.setResetEmail(EMAIL)
    })
    await act(async () => {
      await result.current.handleSendOtp()
    })

    expect(provider.forgotPassword).toHaveBeenCalledExactlyOnceWith(EMAIL)
    expect(result.current.step).toBe('verify-otp')
    expect(result.current.countdown).toBe(60)
  })

  it('shows the same confirmation for an unregistered email', async () => {
    // The provider resolves for unknown addresses precisely so the UI cannot
    // leak which emails exist (BR-08).
    const { result } = renderLoginForm()

    act(() => {
      result.current.setResetEmail('nobody@aurelia.pk')
    })
    await act(async () => {
      await result.current.handleSendOtp()
    })

    expect(result.current.step).toBe('verify-otp')
    expect(result.current.resetError).toBe('')
  })

  it('surfaces a rate limit when requesting a code', async () => {
    provider.forgotPassword.mockRejectedValue(new AuthError('LIMIT_EXCEEDED'))
    const { result } = renderLoginForm()

    act(() => {
      result.current.setResetEmail(EMAIL)
    })
    await act(async () => {
      await result.current.handleSendOtp()
    })

    // Reset-worded, not the sign-in outage copy — nobody is signing in on this
    // screen, and "try again shortly" dropped the one instruction that matters
    // (MET-1256).
    expect(result.current.resetError).toBe(
      'Too many attempts. Please wait a few minutes before trying again.',
    )
    // Never advances to the code step when no code was sent.
    expect(result.current.step).not.toBe('verify-otp')
  })

  it('surfaces a generic failure when requesting a code', async () => {
    provider.forgotPassword.mockRejectedValue(new Error('offline'))
    const { result } = renderLoginForm()

    act(() => {
      result.current.setResetEmail(EMAIL)
    })
    await act(async () => {
      await result.current.handleSendOtp()
    })

    expect(result.current.resetError).toBe('Something went wrong. Please try again.')
  })

  it('requires six digits before leaving the code step', () => {
    const { result } = renderLoginForm()

    act(() => {
      result.current.setOtp('123')
    })
    act(() => {
      result.current.handleVerifyOtp()
    })

    expect(result.current.resetError).toBe('Enter the 6-digit code.')
  })
})

describe('useLoginForm — reset password', () => {
  async function advanceToNewPassword(result: { current: ReturnType<typeof useLoginForm> }) {
    act(() => {
      result.current.setResetEmail(EMAIL)
    })
    await act(async () => {
      await result.current.handleSendOtp()
    })
    act(() => {
      result.current.setOtp('123456')
    })
    act(() => {
      result.current.handleVerifyOtp()
    })
  }

  it('rejects a password that fails the policy', async () => {
    const { result } = renderLoginForm()
    await advanceToNewPassword(result)

    act(() => {
      result.current.setNewPw('aureliaa')
      result.current.setConfirmPw('aureliaa')
    })
    await act(async () => {
      await result.current.handleSavePassword()
    })

    expect(result.current.resetError).toBe(
      'At least 8 characters, plus an uppercase letter, number, or symbol.',
    )
    expect(provider.confirmForgotPassword).not.toHaveBeenCalled()
  })

  it('rejects a short password even with every character class', async () => {
    const { result } = renderLoginForm()
    await advanceToNewPassword(result)

    act(() => {
      result.current.setNewPw('Ab1!')
      result.current.setConfirmPw('Ab1!')
    })
    await act(async () => {
      await result.current.handleSavePassword()
    })

    expect(provider.confirmForgotPassword).not.toHaveBeenCalled()
  })

  it('rejects a mismatched confirmation', async () => {
    const { result } = renderLoginForm()
    await advanceToNewPassword(result)

    act(() => {
      result.current.setNewPw('aurelia1')
      result.current.setConfirmPw('aurelia2')
    })
    await act(async () => {
      await result.current.handleSavePassword()
    })

    expect(result.current.resetError).toBe('Passwords do not match.')
  })

  it('sets the new password and shows the success step', async () => {
    const { result } = renderLoginForm()
    await advanceToNewPassword(result)

    act(() => {
      result.current.setNewPw('aurelia1')
      result.current.setConfirmPw('aurelia1')
    })
    await act(async () => {
      await result.current.handleSavePassword()
    })

    expect(provider.confirmForgotPassword).toHaveBeenCalledExactlyOnceWith(
      EMAIL,
      '123456',
      'aurelia1',
    )
    expect(result.current.step).toBe('success')
  })

  it.each([
    ['CODE_MISMATCH', 'That code is incorrect. Please check and try again.'],
    ['CODE_EXPIRED', 'This code has expired. Request a new one.'],
  ] as const)('sends the partner back to the code step on %s', async (code, copy) => {
    provider.confirmForgotPassword.mockRejectedValue(new AuthError(code))
    const { result } = renderLoginForm()
    await advanceToNewPassword(result)

    act(() => {
      result.current.setNewPw('aurelia1')
      result.current.setConfirmPw('aurelia1')
    })
    await act(async () => {
      await result.current.handleSavePassword()
    })

    // Back on the code step so a resend is reachable (AC-03.5).
    expect(result.current.step).toBe('verify-otp')
    expect(result.current.resetError).toBe(copy)
    expect(result.current.otp).toBe('')
    // Only the code is retyped — the chosen password survives (MET-1245).
    expect(result.current.newPw).toBe('aurelia1')
    expect(result.current.confirmPw).toBe('aurelia1')
  })

  it('keeps the password when the corrected code is resubmitted', async () => {
    provider.confirmForgotPassword.mockRejectedValueOnce(new AuthError('CODE_MISMATCH'))
    const { result } = renderLoginForm()
    await advanceToNewPassword(result)

    act(() => {
      result.current.setNewPw('aurelia1')
      result.current.setConfirmPw('aurelia1')
    })
    await act(async () => {
      await result.current.handleSavePassword()
    })

    // Retype the code only, then continue — the password step is still filled in.
    act(() => {
      result.current.setOtp('654321')
    })
    act(() => {
      result.current.handleVerifyOtp()
    })

    expect(result.current.step).toBe('new-password')
    expect(result.current.newPw).toBe('aurelia1')
    expect(result.current.confirmPw).toBe('aurelia1')

    await act(async () => {
      await result.current.handleSavePassword()
    })

    expect(provider.confirmForgotPassword).toHaveBeenLastCalledWith(EMAIL, '654321', 'aurelia1')
    expect(result.current.step).toBe('success')
  })

  it('starts a fresh reset with empty password fields', async () => {
    const { result } = renderLoginForm()
    await advanceToNewPassword(result)

    act(() => {
      result.current.setNewPw('aurelia1')
      result.current.setConfirmPw('aurelia1')
    })
    act(() => {
      result.current.handleForgotPassword()
    })

    expect(result.current.step).toBe('request-otp')
    expect(result.current.newPw).toBe('')
    expect(result.current.confirmPw).toBe('')
  })

  it('shows the rule when Cognito rejects the password', async () => {
    provider.confirmForgotPassword.mockRejectedValue(new AuthError('INVALID_PASSWORD'))
    const { result } = renderLoginForm()
    await advanceToNewPassword(result)

    act(() => {
      result.current.setNewPw('aurelia1')
      result.current.setConfirmPw('aurelia1')
    })
    await act(async () => {
      await result.current.handleSavePassword()
    })

    expect(result.current.resetError).toBe(
      'At least 8 characters, plus an uppercase letter, number, or symbol.',
    )
  })

  it('surfaces a rate limit on save', async () => {
    provider.confirmForgotPassword.mockRejectedValue(new AuthError('LIMIT_EXCEEDED'))
    const { result } = renderLoginForm()
    await advanceToNewPassword(result)

    act(() => {
      result.current.setNewPw('aurelia1')
      result.current.setConfirmPw('aurelia1')
    })
    await act(async () => {
      await result.current.handleSavePassword()
    })

    expect(result.current.resetError).toBe(
      'Too many attempts. Please wait a few minutes before trying again.',
    )
  })

  it('surfaces a generic failure on save', async () => {
    provider.confirmForgotPassword.mockRejectedValue(new Error('offline'))
    const { result } = renderLoginForm()
    await advanceToNewPassword(result)

    act(() => {
      result.current.setNewPw('aurelia1')
      result.current.setConfirmPw('aurelia1')
    })
    await act(async () => {
      await result.current.handleSavePassword()
    })

    expect(result.current.resetError).toBe('Something went wrong. Please try again.')
  })

  it('resetToLogin clears every field and error', async () => {
    const { result } = renderLoginForm()
    await advanceToNewPassword(result)

    act(() => {
      result.current.setNewPw('aurelia1')
    })
    act(() => {
      result.current.resetToLogin()
    })

    expect(result.current.step).toBe('login')
    expect(result.current.newPw).toBe('')
    expect(result.current.otp).toBe('')
    expect(result.current.loginError).toBe('')
    expect(result.current.resetError).toBe('')
  })
})
