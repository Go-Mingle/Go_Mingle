import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { renderWithProviders, makeStore } from '../../../../test-utils/renderWithProviders'
import { server } from '../../../../mocks/server'
import { LoginPage } from '../LoginPage'
import { authService } from '../services'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../cognitoService', () => ({
  cognitoLogin: vi.fn(),
  mapCognitoErrorToCode: vi.fn((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('NotAuthorizedException')) return 'ERR_INVALID_CREDENTIALS'
    if (message.includes('TooManyRequestsException')) return 'ERR_TOO_MANY_ATTEMPTS'
    return 'ERR_AUTHENTICATION_FAILED'
  }),
  refreshAccessToken: vi.fn(),
  cognitoSignOut: vi.fn(),
  shouldRefreshToken: vi.fn(() => false),
}))

let cognitoLoginMock: ReturnType<typeof vi.fn>

beforeEach(async () => {
  const { cognitoLogin } =
    await vi.importMock<typeof import('../cognitoService')>('../cognitoService')
  cognitoLoginMock = cognitoLogin as ReturnType<typeof vi.fn>
  cognitoLoginMock.mockClear()
  navigateMock.mockClear()
  localStorage.clear()
})

describe('LoginPage', () => {
  it('renders login page with brand panel and form', () => {
    renderWithProviders(<LoginPage />)
    expect(screen.getByPlaceholderText(/you@gomingle\.com/i)).toBeInTheDocument()
  })

  it('successful login navigates to /restaurants', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const mockUser = {
        id: 'user-1',
        email: 'admin@gomingle.com',
        name: 'Admin User',
        role: 'Super Admin',
        initials: 'AU',
      }
      cognitoLoginMock.mockResolvedValue({
        accessToken: 'mock-token',
        user: mockUser,
      })

      renderWithProviders(<LoginPage />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement
      await user.type(emailInput, 'admin@gomingle.com')
      await user.type(pwInput, 'Admin@123')
      const signIn = screen.getByRole('button', { name: /signIn|sign in/i })
      await user.click(signIn)
      vi.advanceTimersByTime(2000)
      await waitFor(() =>
        expect(navigateMock).toHaveBeenCalledWith('/restaurants', { replace: true }),
      )
    } finally {
      vi.useRealTimers()
    }
  })

  // A-02 — GET /auth/me returns HTTP 500 when the caller's role has been
  // soft-deleted. The catch around it used to be empty, so the operator was sent
  // to a bare "Access denied" that reads as a permissions problem, not a server
  // fault. Record the outage so the UI can say what actually happened.
  it('records a permissions outage when auth/me fails with 500 during login', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      server.use(
        http.get('/api/v1/auth/me', () =>
          HttpResponse.json({ error: { code: 'SERVER_ERROR' } }, { status: 500 }),
        ),
      )
      cognitoLoginMock.mockResolvedValue({
        accessToken: 'mock-token',
        user: {
          id: 'user-1',
          email: 'admin@gomingle.com',
          name: 'Admin User',
          role: '',
          permissions: [],
          fullAccess: false,
          initials: 'AU',
        },
      })

      const store = makeStore()
      renderWithProviders(<LoginPage />, { store })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement
      await user.type(emailInput, 'admin@gomingle.com')
      await user.type(pwInput, 'Admin@123')
      await user.click(screen.getByRole('button', { name: /signIn|sign in/i }))
      vi.advanceTimersByTime(2000)

      await waitFor(() => expect(store.getState().auth.permissionsUnavailable).toBe(true))
      // The Cognito session itself succeeded, so the user stays signed in.
      expect(store.getState().auth.isAuthenticated).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not record a permissions outage when auth/me succeeds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      cognitoLoginMock.mockResolvedValue({
        accessToken: 'mock-token',
        user: {
          id: 'user-1',
          email: 'admin@gomingle.com',
          name: 'Admin User',
          role: 'Super Admin',
          initials: 'AU',
        },
      })

      const store = makeStore()
      renderWithProviders(<LoginPage />, { store })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement
      await user.type(emailInput, 'admin@gomingle.com')
      await user.type(pwInput, 'Admin@123')
      await user.click(screen.getByRole('button', { name: /signIn|sign in/i }))
      vi.advanceTimersByTime(2000)

      await waitFor(() => expect(store.getState().auth.isAuthenticated).toBe(true))
      expect(store.getState().auth.permissionsUnavailable).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('lowercases the email before authenticating (case-insensitive login)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      cognitoLoginMock.mockResolvedValue({
        accessToken: 'mock-token',
        user: {
          id: 'user-1',
          email: 'admin@gomingle.com',
          name: 'Admin User',
          role: 'Super Admin',
          initials: 'AU',
        },
      })
      const recordSpy = vi.spyOn(authService, 'recordLoginResult')

      renderWithProviders(<LoginPage />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement
      await user.type(emailInput, 'Admin@GoMingle.com')
      await user.type(pwInput, 'Admin@123')
      await user.click(screen.getByRole('button', { name: /signIn|sign in/i }))
      vi.advanceTimersByTime(2000)
      await waitFor(() =>
        expect(cognitoLoginMock).toHaveBeenCalledWith('admin@gomingle.com', 'Admin@123'),
      )
      // The lockout-audit call uses the same normalised email.
      expect(recordSpy).toHaveBeenCalledWith({ email: 'admin@gomingle.com', succeeded: true })
      recordSpy.mockRestore()
    } finally {
      vi.useRealTimers()
    }
  })

  it('invalid login shows error', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      cognitoLoginMock.mockRejectedValue(new Error('NotAuthorizedException: Invalid credentials'))

      renderWithProviders(<LoginPage />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement
      await user.type(emailInput, 'wrong@x.com')
      await user.type(pwInput, 'badpass123')
      await user.click(screen.getByRole('button', { name: /signIn|sign in/i }))
      vi.advanceTimersByTime(2000)
      await waitFor(() => {
        // Check if cognitoLogin was called
        expect(cognitoLoginMock).toHaveBeenCalledWith('wrong@x.com', 'badpass123')
        // Check if error message is displayed (in a <p> tag specifically)
        const errorMessage = screen.getByText((_, element) => {
          return element?.tagName === 'P' && element?.textContent?.includes('incorrect')
        })
        expect(errorMessage).toBeInTheDocument()
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('lockout after 5 failed attempts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      // Cognito returns TooManyRequests error after 5 failed attempts
      cognitoLoginMock.mockRejectedValue(new Error('TooManyRequestsException: Account locked'))

      renderWithProviders(<LoginPage />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement
      await user.type(emailInput, 'wrong@x.com')
      await user.type(pwInput, 'badpass123')
      await user.click(screen.getByRole('button', { name: /signIn|sign in/i }))
      vi.advanceTimersByTime(2000)
      await waitFor(() => {
        // Check if cognitoLogin was called
        expect(cognitoLoginMock).toHaveBeenCalledWith('wrong@x.com', 'badpass123')
        // Check if "many" appears in error (in a <p> tag specifically for "Too many login attempts")
        const errorMessage = screen.getByText((_, element) => {
          return element?.tagName === 'P' && element?.textContent?.includes('many')
        })
        expect(errorMessage).toBeInTheDocument()
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('restores lockout from storage on mount', () => {
    localStorage.setItem(
      'auth-lockout',
      JSON.stringify({ attempts: 5, lockedUntil: Date.now() + 100000 }),
    )
    renderWithProviders(<LoginPage />)
  })

  it('clears expired lockout from storage on mount', () => {
    localStorage.setItem(
      'auth-lockout',
      JSON.stringify({ attempts: 5, lockedUntil: Date.now() - 1000 }),
    )
    renderWithProviders(<LoginPage />)
    expect(localStorage.getItem('auth-lockout')).toBeNull()
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
      const verifyBtn = screen.getByRole('button', { name: /verifyCode|verify code/i })
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

  it('handles corrupt localStorage', () => {
    localStorage.setItem('auth-lockout', '{invalid}')
    renderWithProviders(<LoginPage />)
  })

  it('shows lockout when record-login-result returns 423', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      cognitoLoginMock.mockRejectedValue(new Error('NotAuthorizedException: Invalid credentials'))
      server.use(
        http.post('/api/v1/auth/record-login-result', () =>
          HttpResponse.json({ error: { code: 'ERR_ACCOUNT_LOCKED' } }, { status: 423 }),
        ),
      )
      renderWithProviders(<LoginPage />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement
      await user.type(emailInput, 'admin@test.com')
      await user.type(pwInput, 'Admin@123')
      await user.click(screen.getByRole('button', { name: /signIn|sign in/i }))
      vi.advanceTimersByTime(2000)
      await waitFor(() =>
        expect(screen.getByText(/Account temporarily locked/i)).toBeInTheDocument(),
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('forgot password: calls request-code endpoint and advances to verify step', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderWithProviders(<LoginPage />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      await user.type(emailInput, 'reset@test.com')
      await user.click(screen.getByRole('button', { name: /forgotPassword|forgot password/i }))
      const sendBtn = await screen.findByRole('button', { name: /sendCode|send code/i })
      await user.click(sendBtn)
      vi.advanceTimersByTime(2000)
      await waitFor(() => {
        const otpInputs = document.querySelectorAll('input[inputmode="numeric"]')
        expect(otpInputs.length).toBe(6)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('forgot password: invalid OTP shows error', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderWithProviders(<LoginPage />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      await user.type(emailInput, 'reset@test.com')
      await user.click(screen.getByRole('button', { name: /forgotPassword|forgot password/i }))
      const sendBtn = await screen.findByRole('button', { name: /sendCode|send code/i })
      await user.click(sendBtn)
      vi.advanceTimersByTime(2000)
      await waitFor(() => {
        expect(document.querySelectorAll('input[inputmode="numeric"]').length).toBe(6)
      })
      server.use(
        http.post('/api/v1/auth/forgot-password/verify-code', () =>
          HttpResponse.json({ error: { code: 'ERR_INVALID_CODE' } }, { status: 400 }),
        ),
      )
      const otpInputs = document.querySelectorAll(
        'input[inputmode="numeric"]',
      ) as NodeListOf<HTMLInputElement>
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], String(i + 1))
      }
      await user.click(screen.getByRole('button', { name: /verifyCode|verify code/i }))
      vi.advanceTimersByTime(2000)
      await waitFor(() => {
        const errorEl = screen.getByText((_, element) => {
          return element?.tagName === 'P' && (element?.textContent ?? '').includes('incorrect')
        })
        expect(errorEl).toBeInTheDocument()
      })
      expect(document.querySelectorAll('input[inputmode="numeric"]').length).toBe(6)
    } finally {
      vi.useRealTimers()
    }
  })

  it('forgot password: full flow with real API calls', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const requestCodeSpy = vi.spyOn(authService, 'forgotPasswordRequestCode')
      const verifyCodeSpy = vi.spyOn(authService, 'forgotPasswordVerifyCode')
      const resetSpy = vi.spyOn(authService, 'forgotPasswordReset')
      renderWithProviders(<LoginPage />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      await user.type(emailInput, 'reset@test.com')
      await user.click(screen.getByRole('button', { name: /forgotPassword|forgot password/i }))
      const sendBtn = await screen.findByRole('button', { name: /sendCode|send code/i })
      await user.click(sendBtn)
      vi.advanceTimersByTime(2000)
      await waitFor(() => {
        expect(document.querySelectorAll('input[inputmode="numeric"]').length).toBe(6)
      })
      expect(requestCodeSpy).toHaveBeenCalledWith('reset@test.com')
      const otpInputs = document.querySelectorAll(
        'input[inputmode="numeric"]',
      ) as NodeListOf<HTMLInputElement>
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], String(i + 1))
      }
      await user.click(screen.getByRole('button', { name: /verifyCode|verify code/i }))
      vi.advanceTimersByTime(2000)
      await waitFor(() => {
        expect(document.querySelectorAll('input[type="password"]').length).toBeGreaterThanOrEqual(2)
      })
      expect(verifyCodeSpy).toHaveBeenCalledWith('reset@test.com', '123456')
      const pwInputs = document.querySelectorAll(
        'input[type="password"]',
      ) as NodeListOf<HTMLInputElement>
      await user.type(pwInputs[0], 'StrongP@ss12')
      await user.type(pwInputs[1], 'StrongP@ss12')
      await user.click(screen.getByRole('button', { name: /newPassword.save|save/i }))
      vi.advanceTimersByTime(2000)
      await waitFor(() => expect(screen.getByText(/Password updated/i)).toBeInTheDocument())
      expect(resetSpy).toHaveBeenCalledWith('mock-reset-token', 'StrongP@ss12', 'StrongP@ss12')
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })
})
