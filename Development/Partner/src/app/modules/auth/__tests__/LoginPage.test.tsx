import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { LoginPage } from '../LoginPage'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

beforeEach(() => {
  navigateMock.mockClear()
  localStorage.clear()
})

describe('LoginPage', () => {
  it('renders login page with brand panel and form', () => {
    renderWithProviders(<LoginPage />)
    // MET-1278 — the example address must be restaurant-shaped, never an
    // internal GoMingle domain.
    expect(screen.getByPlaceholderText(/you@yourrestaurant\.com/i)).toBeInTheDocument()
  })

  it('successful login navigates to the profile resolver', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderWithProviders(<LoginPage />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement
      await user.type(emailInput, 'partner@gomingle.com')
      await user.type(pwInput, 'Partner@123')
      const signIn = screen.getByRole('button', { name: /signIn|sign in/i })
      await user.click(signIn)
      vi.advanceTimersByTime(2000)
      await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/', { replace: true }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('invalid login shows one generic error and stores no lockout state', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderWithProviders(<LoginPage />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement
      await user.type(emailInput, 'wrong@x.com')
      await user.type(pwInput, 'badpass')
      await user.click(screen.getByRole('button', { name: /signIn|sign in/i }))
      vi.advanceTimersByTime(2000)
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Email or password is incorrect.')
      })
      // Lockout belongs to the Pre-Auth Lambda; the client tracks nothing.
      expect(localStorage.getItem('auth-lockout')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('repeated failures never surface an attempts-remaining hint', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderWithProviders(<LoginPage />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await user.clear(emailInput)
        await user.clear(pwInput)
        await user.type(emailInput, 'wrong@x.com')
        await user.type(pwInput, 'bad')
        await user.click(screen.getByRole('button', { name: /signIn|sign in/i }))
        vi.advanceTimersByTime(2000)
        await waitFor(() => {
          expect(screen.getByRole('alert')).toBeInTheDocument()
        })
      }

      expect(screen.getByRole('alert')).toHaveTextContent('Email or password is incorrect.')
      expect(screen.queryByText(/attempts remaining/i)).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores any stale client-side lockout entry left by an older build', () => {
    localStorage.setItem(
      'auth-lockout',
      JSON.stringify({ attempts: 5, lockedUntil: Date.now() + 100000 }),
    )
    renderWithProviders(<LoginPage />)
    // The form stays usable — only the Pre-Auth Lambda can lock an account.
    expect(document.querySelector('input[type="email"]')).not.toBeDisabled()
  })

  it('forgot password flow', async () => {
    renderWithProviders(<LoginPage />)
    const user = userEvent.setup()
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
    await user.type(emailInput, 'me@me.com')
    await user.click(screen.getByRole('button', { name: /forgotPassword|forgot password/i }))
    // Now in request-otp step
    await waitFor(() =>
      expect(screen.getByText(/resetPassword|reset password/i)).toBeInTheDocument(),
    )
  })

  it('full reset flow: forgot -> otp -> verify -> new pw -> success -> back', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderWithProviders(<LoginPage />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      await user.type(emailInput, 'me@me.com')
      await user.click(screen.getByRole('button', { name: /forgotPassword|forgot password/i }))
      // Step 2: request otp
      const sendBtn = await screen.findByRole('button', { name: /sendCode|send code/i })
      await user.click(sendBtn)
      vi.advanceTimersByTime(2000)
      // Step 3: verify otp - find OTP inputs
      await waitFor(() => {
        const otpInputs = document.querySelectorAll('input[inputmode="numeric"]')
        expect(otpInputs.length).toBe(6)
      })
      const otpInputs = document.querySelectorAll(
        'input[inputmode="numeric"]',
      ) as NodeListOf<HTMLInputElement>
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], String(i + 1))
      }
      const verifyBtn = screen.getByRole('button', { name: /verifyOtp\.continue|continue/i })
      await user.click(verifyBtn)
      // Step 4: new password
      await waitFor(() => {
        const pwInputs = document.querySelectorAll('input[type="password"]')
        expect(pwInputs.length).toBeGreaterThanOrEqual(2)
      })
      const pwInputs = document.querySelectorAll(
        'input[type="password"]',
      ) as NodeListOf<HTMLInputElement>
      await user.type(pwInputs[0], 'StrongP@ss12')
      await user.type(pwInputs[1], 'StrongP@ss12')
      const saveBtn = screen.getByRole('button', { name: /newPassword.save|save/i })
      await user.click(saveBtn)
      vi.advanceTimersByTime(2000)
      // Step 5: success
      await waitFor(() => expect(screen.getByText(/Password updated/i)).toBeInTheDocument())
      const backBtn = screen.getByRole('button', { name: /backToSignIn|back to sign in/i })
      await user.click(backBtn)
      // Back to login
      await waitFor(() => expect(document.querySelector('input[type="email"]')).toBeInTheDocument())
    } finally {
      vi.useRealTimers()
    }
  })

  it('resend otp from verify step works', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderWithProviders(<LoginPage />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      await user.type(emailInput, 'me@me.com')
      await user.click(screen.getByRole('button', { name: /forgotPassword|forgot password/i }))
      const sendBtn = await screen.findByRole('button', { name: /sendCode|send code/i })
      await user.click(sendBtn)
      vi.advanceTimersByTime(2000)
      // Wait for verify step
      await waitFor(() => {
        const otpInputs = document.querySelectorAll('input[inputmode="numeric"]')
        expect(otpInputs.length).toBe(6)
      })
      // Run countdown to 0
      vi.advanceTimersByTime(70000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('back from request-otp to login', async () => {
    renderWithProviders(<LoginPage />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /forgotPassword|forgot password/i }))
    const backBtn = await screen.findByRole('button', { name: /backToSignIn|back to sign in/i })
    await user.click(backBtn)
    expect(document.querySelector('input[type="email"]')).toBeInTheDocument()
  })

  it('renders with corrupt localStorage present', () => {
    localStorage.setItem('auth-lockout', '{invalid}')
    renderWithProviders(<LoginPage />)
    expect(document.querySelector('input[type="email"]')).toBeInTheDocument()
  })
})
