import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { AuthError } from '../../../../shared/auth/authError'
import { setAuthProvider } from '../../../../shared/auth/authProvider'
import type { PartnerAuthProvider } from '../../../../shared/auth/types'
import { LoginForm } from '../components/LoginForm'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

beforeEach(() => {
  navigateMock.mockClear()
  localStorage.clear()
})

afterEach(() => {
  setAuthProvider(null)
})

/** Stubs just the calls a step under test makes; the rest stay unimplemented. */
function stubAuthProvider(overrides: Partial<Record<keyof PartnerAuthProvider, unknown>>) {
  setAuthProvider({
    signIn: vi.fn(),
    forgotPassword: vi.fn().mockResolvedValue(undefined),
    confirmForgotPassword: vi.fn().mockResolvedValue(undefined),
    getAccessToken: () => null,
    refresh: vi.fn(),
    signOut: vi.fn(),
    getIdentity: () => null,
    changePassword: vi.fn(),
    ...overrides,
  } as unknown as PartnerAuthProvider)
}

describe('LoginForm', () => {
  it('renders the login step by default with logo and demo credentials', () => {
    renderWithProviders(<LoginForm />)
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByText('partner@gomingle.com')).toBeInTheDocument()
    expect(document.querySelector('input[type="email"]')).toBeInTheDocument()
  })

  it('renders a redirect notice from the signup flow (MET-1283)', () => {
    // The signup screen's own "Already have an account? Sign in" is permanent
    // copy, so the assertion has to be on the login banner itself — the alert
    // that only exists when something is being explained.
    renderWithProviders(<LoginForm />, {
      routes: [
        {
          pathname: '/login',
          state: { authNotice: 'This account already exists. Please sign in.' },
        },
      ],
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This account already exists. Please sign in.',
    )
  })

  it('renders no banner on an ordinary visit to login', () => {
    renderWithProviders(<LoginForm />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('create account button navigates to /signup', async () => {
    renderWithProviders(<LoginForm />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /create an account/i }))
    expect(navigateMock).toHaveBeenCalledWith('/signup')
  })

  it('successful login navigates home', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderWithProviders(<LoginForm />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement
      await user.type(emailInput, 'partner@gomingle.com')
      await user.type(pwInput, 'Partner@123')
      await user.click(screen.getByRole('button', { name: /sign in/i }))
      vi.advanceTimersByTime(2000)
      await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/', { replace: true }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('forgot password opens request-otp step and back returns to login', async () => {
    renderWithProviders(<LoginForm />)
    const user = userEvent.setup()
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
    await user.type(emailInput, 'me@me.com')
    await user.click(screen.getByRole('button', { name: /forgot password/i }))
    expect(await screen.findByText('Reset password')).toBeInTheDocument()
    // Back to login
    await user.click(screen.getByRole('button', { name: /back to sign in/i }))
    await waitFor(() => expect(screen.getByText('Welcome back')).toBeInTheDocument())
  })

  it('sends OTP then reaches verify step, and back returns to request-otp', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderWithProviders(<LoginForm />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      await user.type(emailInput, 'me@me.com')
      await user.click(screen.getByRole('button', { name: /forgot password/i }))
      const sendBtn = await screen.findByRole('button', { name: /send code/i })
      await user.click(sendBtn)
      vi.advanceTimersByTime(2000)
      // verify step now shown
      await waitFor(() => {
        const otpInputs = document.querySelectorAll('input[inputmode="numeric"]')
        expect(otpInputs.length).toBe(6)
      })
      // Back returns to request-otp
      await user.click(screen.getByRole('button', { name: /^back$/i }))
      await waitFor(() => expect(screen.getByText('Reset password')).toBeInTheDocument())
    } finally {
      vi.useRealTimers()
    }
  })

  it('resend code restarts the countdown on the verify step', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderWithProviders(<LoginForm />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      await user.type(emailInput, 'me@me.com')
      await user.click(screen.getByRole('button', { name: /forgot password/i }))
      await user.click(await screen.findByRole('button', { name: /send code/i }))
      vi.advanceTimersByTime(2000)
      await waitFor(() =>
        expect(document.querySelectorAll('input[inputmode="numeric"]').length).toBe(6),
      )
      // Run countdown to 0 so the resend control is shown
      vi.advanceTimersByTime(70000)
      const resend = await screen.findByRole('button', { name: /resend code/i })
      await user.click(resend)
      // Countdown restarted -> resend-in message reappears
      await waitFor(() => expect(screen.getByText(/resend in/i)).toBeInTheDocument())
    } finally {
      vi.useRealTimers()
    }
  })

  // MET-1242 — a rate-limited Send code used to leave the screen
  // indistinguishable from an unresponsive page.
  it('surfaces the rate-limit message as an alert when Send code is throttled', async () => {
    stubAuthProvider({
      forgotPassword: vi.fn().mockRejectedValue(new AuthError('LIMIT_EXCEEDED')),
    })
    renderWithProviders(<LoginForm />)
    const user = userEvent.setup()

    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
    await user.type(emailInput, 'me@me.com')
    await user.click(screen.getByRole('button', { name: /forgot password/i }))
    await user.click(await screen.findByRole('button', { name: /send code/i }))

    const alert = await screen.findByRole('alert')
    // Reset-worded copy, not the sign-in `tooManyAttempts` string: nobody is
    // signing in on this screen, and waiting is the recovery (MET-1256).
    expect(alert).toHaveTextContent(
      'Too many attempts. Please wait a few minutes before trying again.',
    )
    // Still on the email step — no code was sent, so it must not advance.
    expect(screen.getByText('Reset password')).toBeInTheDocument()
    expect(document.querySelectorAll('input[inputmode="numeric"]').length).toBe(0)
  })

  it('surfaces a generic Send code failure as an alert', async () => {
    stubAuthProvider({ forgotPassword: vi.fn().mockRejectedValue(new Error('offline')) })
    renderWithProviders(<LoginForm />)
    const user = userEvent.setup()

    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
    await user.type(emailInput, 'me@me.com')
    await user.click(screen.getByRole('button', { name: /forgot password/i }))
    await user.click(await screen.findByRole('button', { name: /send code/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    )
  })

  it('full reset flow: forgot -> otp -> verify -> new password -> success -> back to login', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderWithProviders(<LoginForm />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      await user.type(emailInput, 'me@me.com')
      await user.click(screen.getByRole('button', { name: /forgot password/i }))
      await user.click(await screen.findByRole('button', { name: /send code/i }))
      vi.advanceTimersByTime(2000)
      await waitFor(() =>
        expect(document.querySelectorAll('input[inputmode="numeric"]').length).toBe(6),
      )
      const otpInputs = document.querySelectorAll(
        'input[inputmode="numeric"]',
      ) as NodeListOf<HTMLInputElement>
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], String(i + 1))
      }
      await user.click(screen.getByRole('button', { name: /^continue$/i }))
      // new-password step
      await waitFor(() =>
        expect(document.querySelectorAll('input[type="password"]').length).toBeGreaterThanOrEqual(
          2,
        ),
      )
      const pwInputs = document.querySelectorAll(
        'input[type="password"]',
      ) as NodeListOf<HTMLInputElement>
      await user.type(pwInputs[0], 'StrongP@ss12')
      await user.type(pwInputs[1], 'StrongP@ss12')
      await user.click(screen.getByRole('button', { name: /save new password/i }))
      vi.advanceTimersByTime(2000)
      // success step
      await waitFor(() => expect(screen.getByText('Password updated')).toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: /back to sign in/i }))
      // resetToLogin returns to the login step
      await waitFor(() => expect(screen.getByText('Welcome back')).toBeInTheDocument())
    } finally {
      vi.useRealTimers()
    }
  })
})
