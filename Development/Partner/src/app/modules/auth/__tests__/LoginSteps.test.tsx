import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import {
  LoginStep,
  RequestOtpStep,
  VerifyOtpStep,
  NewPasswordStep,
  SuccessStep,
} from '../components/LoginSteps'

const tFn = ((k: string) => k) as (k: string, opts?: Record<string, unknown>) => string

describe('LoginSteps barrel', () => {
  it('re-exports every step component', () => {
    expect(LoginStep).toBeTypeOf('function')
    expect(RequestOtpStep).toBeTypeOf('function')
    expect(VerifyOtpStep).toBeTypeOf('function')
    expect(NewPasswordStep).toBeTypeOf('function')
    expect(SuccessStep).toBeTypeOf('function')
  })

  it('LoginStep re-export renders the real component', () => {
    renderWithProviders(
      <LoginStep loading={false} loginError="" onForgotPassword={() => {}} t={tFn} />,
    )
    expect(screen.getByText('welcomeBack')).toBeInTheDocument()
  })

  it('RequestOtpStep re-export renders the real component', () => {
    renderWithProviders(
      <RequestOtpStep
        resetEmail="a@b.c"
        setResetEmail={() => {}}
        loading={false}
        onBack={() => {}}
        onSend={() => {}}
      />,
    )
    expect(screen.getByText(/reset password/i)).toBeInTheDocument()
  })

  it('VerifyOtpStep re-export renders the real component', () => {
    renderWithProviders(
      <VerifyOtpStep
        otp=""
        setOtp={() => {}}
        countdown={30}
        resetEmail="a@b.c"
        onBack={() => {}}
        onVerify={() => {}}
        onResend={() => {}}
      />,
    )
    expect(screen.getByText(/enter code/i)).toBeInTheDocument()
  })

  it('NewPasswordStep re-export renders the real component', () => {
    renderWithProviders(
      <NewPasswordStep
        newPw=""
        setNewPw={() => {}}
        confirmPw=""
        setConfirmPw={() => {}}
        loading={false}
        onSave={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /save new password/i })).toBeInTheDocument()
  })

  it('SuccessStep re-export renders the real component', () => {
    const onBack = vi.fn()
    renderWithProviders(<SuccessStep onBack={onBack} />)
    expect(screen.getByText(/password updated/i)).toBeInTheDocument()
  })
})
