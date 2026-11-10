import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../mocks/server'
import { sessionResponses } from '../../../../../mocks/data/partnerSession'
import {
  MOCK_REGISTERED_EMAIL,
  MOCK_SIGNUP_ACCESS_TOKEN,
  MOCK_SIGNUP_CODE,
  signupResponses,
} from '../../../../../mocks/data/partnerSignup'
import { AllProviders, makeQueryClient } from '../../../../../test-utils/renderWithProviders'
import { __clearSessionListeners } from '../../../../../shared/auth/sessionEvents'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { SESSION_ENDPOINTS } from '../../../session/constants'
import { SIGNUP_ENDPOINTS } from '../../constants'
import { useSignUpFlow } from '../useSignUpFlow'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const EMAIL = 'new@aurelia.pk'
const VALID_PW = 'aurelia1'

function renderFlow() {
  const queryClient = makeQueryClient()
  return renderHook(() => useSignUpFlow(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
}

/** Drives the flow to the code step. */
async function advanceToCodeStep(result: { current: ReturnType<typeof useSignUpFlow> }) {
  act(() => {
    result.current.setEmail(EMAIL)
  })
  act(() => {
    result.current.handleSendOtp()
  })
  await waitFor(() => {
    expect(result.current.step).toBe('otp')
  })
}

/** Drives the flow to the password step, with the email verified. */
async function advanceToPasswordStep(result: { current: ReturnType<typeof useSignUpFlow> }) {
  await advanceToCodeStep(result)
  act(() => {
    result.current.setOtp(MOCK_SIGNUP_CODE)
  })
  act(() => {
    result.current.handleVerifyOtp()
  })
  await waitFor(() => {
    expect(result.current.step).toBe('password')
  })
}

beforeEach(() => {
  navigateMock.mockClear()
})

afterEach(() => {
  __clearSessionListeners()
  vi.useRealTimers()
})

describe('step 1 — start', () => {
  it('starts on the email step', () => {
    const { result } = renderFlow()
    expect(result.current.step).toBe('email')
  })

  it('rejects a malformed email without calling the API', async () => {
    let calls = 0
    server.use(
      http.post(SIGNUP_ENDPOINTS.start, () => {
        calls += 1
        return signupResponses.codeSent()
      }),
    )
    const { result } = renderFlow()

    act(() => {
      result.current.setEmail('not-an-email')
    })
    act(() => {
      result.current.handleSendOtp()
    })

    expect(result.current.stepError).toBe('Enter a valid email address.')
    expect(result.current.step).toBe('email')
    expect(calls).toBe(0)
  })

  it('sends only the trimmed email and advances with the cooldown running', async () => {
    let body: unknown
    server.use(
      http.post(SIGNUP_ENDPOINTS.start, async ({ request }) => {
        body = await request.json()
        return signupResponses.codeSent()
      }),
    )
    const { result } = renderFlow()

    act(() => {
      result.current.setEmail(`  ${EMAIL}  `)
    })
    act(() => {
      result.current.handleSendOtp()
    })

    await waitFor(() => {
      expect(result.current.step).toBe('otp')
    })
    expect(body).toEqual({ email: EMAIL })
    expect(result.current.countdown).toBe(60)
  })

  it('routes an already-registered email to sign-in, carrying the reason', async () => {
    // MET-1283 — the redirect has to arrive with the backend's own sentence. A
    // toast cannot carry it: SignUpPage's contextHolder unmounts on the same
    // navigate, so the partner used to land on /login with nothing to read.
    const { result } = renderFlow()

    act(() => {
      result.current.setEmail(MOCK_REGISTERED_EMAIL)
    })
    act(() => {
      result.current.handleSendOtp()
    })

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login', {
        replace: true,
        state: { authNotice: 'This account already exists. Please sign in.' },
      })
    })
    expect(result.current.step).toBe('email')
  })

  it('prefers the backend wording over local copy in the redirect notice', async () => {
    server.use(
      http.post(SIGNUP_ENDPOINTS.start, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_ALREADY_REGISTERED',
              message: 'That address is already registered to another restaurant.',
            },
          },
          { status: 409 },
        ),
      ),
    )
    const { result } = renderFlow()

    act(() => {
      result.current.setEmail(EMAIL)
    })
    act(() => {
      result.current.handleSendOtp()
    })

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login', {
        replace: true,
        state: { authNotice: 'That address is already registered to another restaurant.' },
      })
    })
  })

  it('offers a retry when the service is unavailable', async () => {
    server.use(http.post(SIGNUP_ENDPOINTS.start, signupResponses.unavailable))
    const { result } = renderFlow()

    act(() => {
      result.current.setEmail(EMAIL)
    })
    act(() => {
      result.current.handleSendOtp()
    })

    await waitFor(() => {
      expect(result.current.stepError).toBe("We're having trouble reaching the server. Retrying…")
    })
    expect(result.current.step).toBe('email')
  })

  it('names a recovery instead of the backend "Something went wrong." on a 500', async () => {
    // MET-1280 — an address with prior failed verifications answers 500
    // ERR_INTERNAL here. The backend's own sentence named no route out, and the
    // address is neither registered (so sign-in is impossible) nor usable (so
    // signup is impossible), which made it a permanent dead end.
    server.use(http.post(SIGNUP_ENDPOINTS.start, signupResponses.internal))
    const { result } = renderFlow()

    act(() => {
      result.current.setEmail(EMAIL)
    })
    act(() => {
      result.current.handleSendOtp()
    })

    await waitFor(() => {
      expect(result.current.stepError).toBe(
        "We couldn't send a code to this address just now. Please try again in a few minutes — if a code already reached your inbox, you can enter it below.",
      )
    })
    expect(result.current.step).toBe('email')
    expect(result.current.canEnterExistingCode).toBe(true)
  })

  it('tells the partner to wait when the address is throttled', async () => {
    server.use(http.post(SIGNUP_ENDPOINTS.start, signupResponses.throttled))
    const { result } = renderFlow()

    act(() => {
      result.current.setEmail(EMAIL)
    })
    act(() => {
      result.current.handleSendOtp()
    })

    await waitFor(() => {
      expect(result.current.stepError).toBe(
        'A code was requested for this address recently. Please wait a few minutes before requesting another.',
      )
    })
    // A throttle means a code went out recently, so the inbox is the way through.
    expect(result.current.canEnterExistingCode).toBe(true)
    expect(result.current.step).toBe('email')
  })

  it('withdraws the existing-code route on the next send attempt', async () => {
    server.use(http.post(SIGNUP_ENDPOINTS.start, signupResponses.throttled))
    const { result } = renderFlow()

    act(() => {
      result.current.setEmail(EMAIL)
    })
    act(() => {
      result.current.handleSendOtp()
    })
    await waitFor(() => {
      expect(result.current.canEnterExistingCode).toBe(true)
    })

    server.use(http.post(SIGNUP_ENDPOINTS.start, signupResponses.codeSent))
    act(() => {
      result.current.handleSendOtp()
    })

    await waitFor(() => {
      expect(result.current.step).toBe('otp')
    })
    expect(result.current.canEnterExistingCode).toBe(false)
  })

  it('does not offer the existing-code route for a 503', async () => {
    // Transient infrastructure, not a refused address — the retry copy already
    // says what to do and no code was ever promised.
    server.use(http.post(SIGNUP_ENDPOINTS.start, signupResponses.unavailable))
    const { result } = renderFlow()

    act(() => {
      result.current.setEmail(EMAIL)
    })
    act(() => {
      result.current.handleSendOtp()
    })

    await waitFor(() => {
      expect(result.current.stepError).toBe("We're having trouble reaching the server. Retrying…")
    })
    expect(result.current.canEnterExistingCode).toBe(false)
  })

  it('still shows the backend wording for a 4xx that is not a throttle', async () => {
    // The 5xx and 429 branches must not swallow the ordinary validation path —
    // only the backend knows why it rejected a specific address.
    server.use(
      http.post(SIGNUP_ENDPOINTS.start, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_VALIDATION', message: 'That domain is blocked.' } },
          { status: 422 },
        ),
      ),
    )
    const { result } = renderFlow()

    act(() => {
      result.current.setEmail(EMAIL)
    })
    act(() => {
      result.current.handleSendOtp()
    })

    await waitFor(() => {
      expect(result.current.stepError).toBe('That domain is blocked.')
    })
    expect(result.current.canEnterExistingCode).toBe(false)
  })

  it('completes signup from a code the partner already held after start refused', async () => {
    // The whole point of the recovery: `verify` is a different endpoint and takes
    // the email and code together, so a code an earlier `start` delivered still
    // gets the partner through even while `start` keeps refusing the address.
    server.use(http.post(SIGNUP_ENDPOINTS.start, signupResponses.internal))
    const { result } = renderFlow()

    act(() => {
      result.current.setEmail(EMAIL)
    })
    act(() => {
      result.current.handleSendOtp()
    })
    await waitFor(() => {
      expect(result.current.canEnterExistingCode).toBe(true)
    })

    act(() => {
      result.current.enterExistingCode()
    })

    expect(result.current.step).toBe('otp')
    expect(result.current.otp).toBe('')
    expect(result.current.stepError).toBe('')
    expect(result.current.canEnterExistingCode).toBe(false)
    // Nothing was just sent, so resend must be reachable rather than sitting
    // behind a cooldown for a code that never left.
    expect(result.current.countdown).toBe(0)

    act(() => {
      result.current.setOtp(MOCK_SIGNUP_CODE)
    })
    act(() => {
      result.current.handleVerifyOtp()
    })

    await waitFor(() => {
      expect(result.current.step).toBe('password')
    })
  })
})

describe('step 2 — resend', () => {
  it('is blocked while the cooldown is running', async () => {
    let calls = 0
    server.use(
      http.post(SIGNUP_ENDPOINTS.resend, () => {
        calls += 1
        return signupResponses.codeSent()
      }),
    )
    const { result } = renderFlow()
    await advanceToCodeStep(result)

    act(() => {
      result.current.resendOtp()
    })

    expect(calls).toBe(0)
  })

  it('re-issues the code once the cooldown elapses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let calls = 0
      server.use(
        http.post(SIGNUP_ENDPOINTS.resend, () => {
          calls += 1
          return signupResponses.codeSent()
        }),
      )
      const { result } = renderFlow()
      await advanceToCodeStep(result)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })
      expect(result.current.countdown).toBe(0)

      act(() => {
        result.current.resendOtp()
      })

      await waitFor(() => {
        expect(calls).toBe(1)
      })
      await waitFor(() => {
        expect(result.current.countdown).toBe(60)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('restarts the visible countdown when the server reports a cooldown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      server.use(http.post(SIGNUP_ENDPOINTS.resend, signupResponses.resendCooldown))
      const { result } = renderFlow()
      await advanceToCodeStep(result)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })

      act(() => {
        result.current.resendOtp()
      })

      // The server is the authority: put the countdown back rather than leaving
      // the button enabled early.
      await waitFor(() => {
        expect(result.current.countdown).toBe(60)
      })
      expect(result.current.stepError).toBe(
        'Please wait for the countdown before requesting another code.',
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('points at the code already sent when a resend fails outright', async () => {
    // MET-1280 — this step has the code field right here, so a failed resend is
    // not a dead end the way a failed `start` is. Say so instead of showing the
    // backend's bare "Something went wrong."
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      server.use(http.post(SIGNUP_ENDPOINTS.resend, signupResponses.internal))
      const { result } = renderFlow()
      await advanceToCodeStep(result)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })
      act(() => {
        result.current.resendOtp()
      })

      await waitFor(() => {
        expect(result.current.stepError).toBe(
          "We couldn't send a new code just now. Enter the code we already sent you, or try again in a few minutes.",
        )
      })
      expect(result.current.step).toBe('otp')
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers a retry when the resend service is unavailable', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      server.use(http.post(SIGNUP_ENDPOINTS.resend, signupResponses.unavailable))
      const { result } = renderFlow()
      await advanceToCodeStep(result)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })
      act(() => {
        result.current.resendOtp()
      })

      await waitFor(() => {
        expect(result.current.stepError).toBe("We're having trouble reaching the server. Retrying…")
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('distinguishes a pool-level throttle from our own 60s cooldown', async () => {
    // MET-1280 — a Cognito limit arrives as a 429 under a different code, so
    // branching on ERR_RESET_CODE_COOLDOWN alone let it fall through to the
    // generic copy. The countdown still goes back so the button cannot be
    // hammered, but the wording must not point at a 60s countdown that is
    // shorter than the limit it stands in for.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      server.use(http.post(SIGNUP_ENDPOINTS.resend, signupResponses.throttled))
      const { result } = renderFlow()
      await advanceToCodeStep(result)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })
      act(() => {
        result.current.resendOtp()
      })

      await waitFor(() => {
        expect(result.current.stepError).toBe(
          'Too many code requests for this address. Please wait a few minutes before trying again.',
        )
      })
      expect(result.current.countdown).toBe(60)
    } finally {
      vi.useRealTimers()
    }
  })

  it('still shows the backend wording for a 4xx resend rejection', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      server.use(
        http.post(SIGNUP_ENDPOINTS.resend, () =>
          HttpResponse.json(
            {
              success: false,
              error: { code: 'ERR_VALIDATION', message: 'That address is no longer pending.' },
            },
            { status: 422 },
          ),
        ),
      )
      const { result } = renderFlow()
      await advanceToCodeStep(result)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })
      act(() => {
        result.current.resendOtp()
      })

      await waitFor(() => {
        expect(result.current.stepError).toBe('That address is no longer pending.')
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('step 3 — verify', () => {
  it('requires six digits before calling the API', async () => {
    let calls = 0
    server.use(
      http.post(SIGNUP_ENDPOINTS.verify, () => {
        calls += 1
        return signupResponses.verified()
      }),
    )
    const { result } = renderFlow()
    await advanceToCodeStep(result)

    act(() => {
      result.current.setOtp('123')
    })
    act(() => {
      result.current.handleVerifyOtp()
    })

    expect(result.current.stepError).toBe('Enter the 6-digit code.')
    expect(calls).toBe(0)
  })

  it('stores the session it returns — the partner is logged in here', async () => {
    const { result } = renderFlow()
    await advanceToCodeStep(result)

    act(() => {
      result.current.setOtp(MOCK_SIGNUP_CODE)
    })
    act(() => {
      result.current.handleVerifyOtp()
    })

    await waitFor(() => {
      expect(result.current.step).toBe('password')
    })
    // The password screen is a post-login screen now.
    expect(tokenStore.getAccessToken()).toBe(MOCK_SIGNUP_ACCESS_TOKEN)
    expect(tokenStore.getRefreshToken()).toBe('signup-refresh-token')
    expect(tokenStore.getExpiresAt()).toBeGreaterThan(Date.now())
  })

  it('sends the email and code, then advances to the password step', async () => {
    let body: unknown
    server.use(
      http.post(SIGNUP_ENDPOINTS.verify, async ({ request }) => {
        body = await request.json()
        return signupResponses.verified()
      }),
    )
    const { result } = renderFlow()
    await advanceToCodeStep(result)

    act(() => {
      result.current.setOtp(MOCK_SIGNUP_CODE)
    })
    act(() => {
      result.current.handleVerifyOtp()
    })

    await waitFor(() => {
      expect(result.current.step).toBe('password')
    })
    expect(body).toEqual({ email: EMAIL, code: MOCK_SIGNUP_CODE })
  })

  it('shows the backend wording for an incorrect code', async () => {
    const { result } = renderFlow()
    await advanceToCodeStep(result)

    act(() => {
      result.current.setOtp('000000')
    })
    act(() => {
      result.current.handleVerifyOtp()
    })

    await waitFor(() => {
      expect(result.current.stepError).toBe('That code is incorrect. Check it and try again.')
    })
    expect(result.current.step).toBe('otp')
  })

  it('shows the backend wording for an expired code', async () => {
    server.use(http.post(SIGNUP_ENDPOINTS.verify, signupResponses.codeExpired))
    const { result } = renderFlow()
    await advanceToCodeStep(result)

    act(() => {
      result.current.setOtp(MOCK_SIGNUP_CODE)
    })
    act(() => {
      result.current.handleVerifyOtp()
    })

    await waitFor(() => {
      expect(result.current.stepError).toBe('This code has expired. Request a new one.')
    })
  })

  it('sends the partner back to email entry when the signup session has expired', async () => {
    // Same 422 ERR_VALIDATION as a wrong code, so only the message separates
    // them. Treating it as a code error would leave the partner retyping a
    // perfectly valid code forever.
    server.use(http.post(SIGNUP_ENDPOINTS.verify, signupResponses.signupSessionExpired))
    const { result } = renderFlow()
    await advanceToCodeStep(result)

    act(() => {
      result.current.setOtp(MOCK_SIGNUP_CODE)
    })
    act(() => {
      result.current.handleVerifyOtp()
    })

    await waitFor(() => {
      expect(result.current.step).toBe('email')
    })
    expect(result.current.otp).toBe('')
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('routes to sign-in when the code was already spent', async () => {
    // Cognito reports an already-CONFIRMED user here, which the backend maps to
    // ERR_ALREADY_REGISTERED — the common path for a returning partner.
    server.use(http.post(SIGNUP_ENDPOINTS.verify, signupResponses.alreadyRegistered))
    const { result } = renderFlow()
    await advanceToCodeStep(result)

    act(() => {
      result.current.setOtp(MOCK_SIGNUP_CODE)
    })
    act(() => {
      result.current.handleVerifyOtp()
    })

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login', {
        replace: true,
        state: { authNotice: 'This account already exists. Please sign in.' },
      })
    })
  })

  it('does not advance to the password step when verify returns no usable session', async () => {
    // `complete` is Bearer-authenticated, so continuing here would send
    // `Bearer undefined` and draw a 401 that reads like an expired session
    // rather than the contract mismatch it is.
    server.use(
      http.post(SIGNUP_ENDPOINTS.verify, () =>
        HttpResponse.json(
          {
            success: true,
            data: {
              partnerUser: { id: 'pu-new', email: EMAIL, isPrimary: true },
              restaurant: { id: 'restDraft', status: 'DRAFT' },
              route: 'PROFILE_SETUP',
              session: { expiresIn: 7200, tokenType: 'Bearer' },
            },
          },
          { status: 201 },
        ),
      ),
    )
    const { result } = renderFlow()
    await advanceToCodeStep(result)

    act(() => {
      result.current.setOtp(MOCK_SIGNUP_CODE)
    })
    act(() => {
      result.current.handleVerifyOtp()
    })

    // Routed to sign-in: the account exists, and Forgot Password is the
    // documented recovery for an account still on the temp password. That copy
    // rides along in router state, or the redirect explains nothing (MET-1283).
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login', {
        replace: true,
        state: {
          authNotice:
            'Your account was created, but we could not sign you in. Use Forgot password to set your password.',
        },
      })
    })
    expect(result.current.step).not.toBe('password')
    expect(tokenStore.hasSession()).toBe(false)
  })

  it('back returns to email entry with the address preserved', async () => {
    const { result } = renderFlow()
    await advanceToCodeStep(result)

    act(() => {
      result.current.backToEmail()
    })

    expect(result.current.step).toBe('email')
    expect(result.current.email).toBe(EMAIL)
  })
})

describe('step 4 — complete', () => {
  it('blocks a password with no upper, number or symbol', async () => {
    const { result } = renderFlow()
    await advanceToPasswordStep(result)

    act(() => {
      result.current.setNewPw('aureliaa')
      result.current.setConfirmPw('aureliaa')
    })
    act(() => {
      result.current.handleCreateAccount()
    })

    expect(result.current.stepError).toBe(
      'At least 8 characters, plus an uppercase letter, number, or symbol.',
    )
  })

  it('blocks a short password even with every character class', async () => {
    const { result } = renderFlow()
    await advanceToPasswordStep(result)

    act(() => {
      result.current.setNewPw('Ab1!')
      result.current.setConfirmPw('Ab1!')
    })
    act(() => {
      result.current.handleCreateAccount()
    })

    expect(result.current.stepError).toBe(
      'At least 8 characters, plus an uppercase letter, number, or symbol.',
    )
  })

  it('blocks a confirmation mismatch client-side', async () => {
    const { result } = renderFlow()
    await advanceToPasswordStep(result)

    act(() => {
      result.current.setNewPw(VALID_PW)
      result.current.setConfirmPw('aurelia2')
    })
    act(() => {
      result.current.handleCreateAccount()
    })

    expect(result.current.stepError).toBe('Passwords do not match.')
  })

  it('sends only the password', async () => {
    let sent: Record<string, unknown> = {}
    server.use(
      http.post(SIGNUP_ENDPOINTS.complete, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>
        return signupResponses.passwordSet()
      }),
    )
    const { result } = renderFlow()
    await advanceToPasswordStep(result)

    act(() => {
      result.current.setNewPw(VALID_PW)
      result.current.setConfirmPw(VALID_PW)
    })
    act(() => {
      result.current.handleCreateAccount()
    })

    // The email comes from the Bearer token; sending it would be a 422.
    await waitFor(() => {
      expect(Object.keys(sent)).toEqual(['password'])
    })
  })

  it('records the login once, then lands on the route verify returned', async () => {
    let recorded = 0
    server.use(
      http.post(SESSION_ENDPOINTS.loginRecorded, () => {
        recorded += 1
        return sessionResponses.loginRecorded()
      }),
    )
    const { result } = renderFlow()
    await advanceToPasswordStep(result)

    act(() => {
      result.current.setNewPw(VALID_PW)
      result.current.setConfirmPw(VALID_PW)
    })
    act(() => {
      result.current.handleCreateAccount()
    })

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/overview', { replace: true })
    })
    await waitFor(() => {
      expect(recorded).toBe(1)
    })
    // The session came from verify, and setting the password leaves it alone.
    expect(tokenStore.getAccessToken()).toBe(MOCK_SIGNUP_ACCESS_TOKEN)
  })

  it('still enters the portal when recording the login fails', async () => {
    // Best-effort (J2 BR-16): a failure must never gate the redirect.
    server.use(http.post(SESSION_ENDPOINTS.loginRecorded, sessionResponses.internal))
    const { result } = renderFlow()
    await advanceToPasswordStep(result)

    act(() => {
      result.current.setNewPw(VALID_PW)
      result.current.setConfirmPw(VALID_PW)
    })
    act(() => {
      result.current.handleCreateAccount()
    })

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/overview', { replace: true })
    })
    expect(tokenStore.hasSession()).toBe(true)
  })

  it('shows the backend rule when the password is rejected server-side', async () => {
    server.use(http.post(SIGNUP_ENDPOINTS.complete, signupResponses.passwordRejected))
    const { result } = renderFlow()
    await advanceToPasswordStep(result)

    act(() => {
      result.current.setNewPw(VALID_PW)
      result.current.setConfirmPw(VALID_PW)
    })
    act(() => {
      result.current.handleCreateAccount()
    })

    await waitFor(() => {
      expect(result.current.stepError).toBe(
        'At least 8 characters, plus an uppercase letter, number, or symbol.',
      )
    })
    expect(result.current.step).toBe('password')
  })

  it('shows a 409 in place without redirecting', async () => {
    // MET-1279: the counter-evidence that specific errors are not swallowed on
    // this endpoint. A 409 renders under the input with the backend's own
    // sentence and the partner stays put; only a 401 hands off to the session
    // handler, because there the session — not the input — is what failed.
    server.use(http.post(SIGNUP_ENDPOINTS.complete, signupResponses.alreadyRegistered))
    const { result } = renderFlow()
    await advanceToPasswordStep(result)

    act(() => {
      result.current.setNewPw(VALID_PW)
      result.current.setConfirmPw(VALID_PW)
    })
    act(() => {
      result.current.handleCreateAccount()
    })

    await waitFor(() => {
      expect(result.current.stepError).toBe('This account already exists. Please sign in.')
    })
    expect(result.current.step).toBe('password')
    expect(navigateMock).not.toHaveBeenCalled()
    expect(tokenStore.hasSession()).toBe(true)
  })

  it('offers a retry when the service is unavailable', async () => {
    server.use(http.post(SIGNUP_ENDPOINTS.complete, signupResponses.unavailable))
    const { result } = renderFlow()
    await advanceToPasswordStep(result)

    act(() => {
      result.current.setNewPw(VALID_PW)
      result.current.setConfirmPw(VALID_PW)
    })
    act(() => {
      result.current.handleCreateAccount()
    })

    await waitFor(() => {
      expect(result.current.stepError).toBe("We're having trouble reaching the server. Retrying…")
    })
  })

  it('keeps the partner on the password step after a retryable 500', async () => {
    server.use(http.post(SIGNUP_ENDPOINTS.complete, signupResponses.internal))
    const { result } = renderFlow()
    await advanceToPasswordStep(result)

    act(() => {
      result.current.setNewPw(VALID_PW)
      result.current.setConfirmPw(VALID_PW)
    })
    act(() => {
      result.current.handleCreateAccount()
    })

    await waitFor(() => {
      expect(result.current.stepError).toBe('Something went wrong. Please try again.')
    })
    expect(result.current.step).toBe('password')
  })
})
