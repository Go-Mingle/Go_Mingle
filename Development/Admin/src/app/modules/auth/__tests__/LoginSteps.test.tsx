import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import {
  LoginStep,
  RequestOtpStep,
  VerifyOtpStep,
  NewPasswordStep,
  SuccessStep,
} from '../components/LoginSteps'

const tFn = ((k: string, opts?: Record<string, unknown>) => {
  if (opts && 'time' in opts) return `${k}:${opts.time}`
  return k
}) as (k: string, opts?: Record<string, unknown>) => string

// The LoginSteps barrel re-exports every step component. These tests cover the
// branches the AuthSteps suite leaves untouched — notably the VerifyOtpStep
// error banner and disabled/loading button states.
describe('LoginSteps barrel re-exports', () => {
  it('re-exports all step components as callable functions', () => {
    expect(typeof LoginStep).toBe('function')
    expect(typeof RequestOtpStep).toBe('function')
    expect(typeof VerifyOtpStep).toBe('function')
    expect(typeof NewPasswordStep).toBe('function')
    expect(typeof SuccessStep).toBe('function')
  })
})

describe('VerifyOtpStep — error and loading branches', () => {
  it('renders the error message when error prop is provided', () => {
    renderWithProviders(
      <VerifyOtpStep
        otp="123456"
        setOtp={() => {}}
        countdown={0}
        resetEmail="a@b.c"
        onBack={() => {}}
        onVerify={() => {}}
        onResend={() => {}}
        error="Invalid code"
      />,
    )
    expect(screen.getByText('Invalid code')).toBeInTheDocument()
  })

  it('disables the verify button while loading even with a full OTP', () => {
    renderWithProviders(
      <VerifyOtpStep
        otp="123456"
        setOtp={() => {}}
        countdown={0}
        resetEmail="a@b.c"
        onBack={() => {}}
        onVerify={() => {}}
        onResend={() => {}}
        loading
      />,
    )
    expect(screen.getByRole('button', { name: /verify code/i })).toBeDisabled()
  })

  it('disables the verify button when OTP is incomplete', () => {
    renderWithProviders(
      <VerifyOtpStep
        otp="12"
        setOtp={() => {}}
        countdown={0}
        resetEmail="a@b.c"
        onBack={() => {}}
        onVerify={() => {}}
        onResend={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /verify code/i })).toBeDisabled()
  })

  it('does not invoke onVerify when the disabled button is clicked', async () => {
    const onVerify = vi.fn()
    renderWithProviders(
      <VerifyOtpStep
        otp="123"
        setOtp={() => {}}
        countdown={5}
        resetEmail="a@b.c"
        onBack={() => {}}
        onVerify={onVerify}
        onResend={() => {}}
      />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: /verify code/i }))
    expect(onVerify).not.toHaveBeenCalled()
  })
})

describe('LoginStep — demo credentials absent branch', () => {
  it('does not render the demo block when credentials are missing', () => {
    renderWithProviders(
      <LoginStep
        loading={false}
        loginError=""
        lockoutRemaining={0}
        formatLockoutTime={(s) => `${s}`}
        onForgotPassword={() => {}}
        t={tFn}
      />,
    )
    expect(screen.queryByText(/demo credentials/i)).not.toBeInTheDocument()
  })

  it('hides the login error while the account is locked out', () => {
    renderWithProviders(
      <LoginStep
        loading={false}
        loginError="bad creds"
        lockoutRemaining={120}
        formatLockoutTime={(s) => `${s}`}
        onForgotPassword={() => {}}
        t={tFn}
      />,
    )
    expect(screen.queryByText('bad creds')).not.toBeInTheDocument()
  })
})
