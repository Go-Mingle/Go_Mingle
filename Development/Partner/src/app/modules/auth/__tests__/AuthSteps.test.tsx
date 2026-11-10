import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { LoginStep } from '../components/LoginStep'
import { RequestOtpStep } from '../components/RequestOtpStep'
import { VerifyOtpStep } from '../components/VerifyOtpStep'
import { NewPasswordStep, SuccessStep } from '../components/PasswordSteps'

const tFn = ((k: string, opts?: Record<string, unknown>) => {
  if (opts && 'time' in opts) return `${k}:${opts.time}`
  if (opts && 'remaining' in opts) return `${k}:${opts.remaining}`
  return k
}) as (k: string, opts?: Record<string, unknown>) => string

describe('LoginStep', () => {
  it('shows demo credentials, no lockout', () => {
    renderWithProviders(
      <LoginStep
        loading={false}
        loginError=""
        onForgotPassword={() => {}}
        t={tFn}
        demoEmail="d@e.f"
        demoPassword="pw"
      />,
    )
    expect(screen.getByText('d@e.f')).toBeInTheDocument()
  })

  it('shows a Pre-Auth lock rejection verbatim, with no attempts-remaining hint', () => {
    const lockCopy = 'Your account is temporarily locked. Try again in 15 minutes.'
    renderWithProviders(
      <LoginStep loading={false} loginError={lockCopy} onForgotPassword={() => {}} t={tFn} />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(lockCopy)
    expect(screen.queryByText(/attempts remaining/i)).not.toBeInTheDocument()
  })

  it('shows a suspension rejection verbatim', () => {
    const suspendedCopy = 'Your account has been suspended. Please contact support.'
    renderWithProviders(
      <LoginStep loading={false} loginError={suspendedCopy} onForgotPassword={() => {}} t={tFn} />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(suspendedCopy)
  })

  it('shows a generic credential error', () => {
    renderWithProviders(
      <LoginStep loading={false} loginError="bad creds" onForgotPassword={() => {}} t={tFn} />,
    )
    expect(screen.getByText('bad creds')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    renderWithProviders(<LoginStep loading loginError="" onForgotPassword={() => {}} t={tFn} />)
    expect(screen.getByText(/common:status\.loading/i)).toBeInTheDocument()
  })

  it('calls onForgotPassword when clicked', async () => {
    const onForgot = vi.fn()
    renderWithProviders(
      <LoginStep loading={false} loginError="" onForgotPassword={onForgot} t={tFn} />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: /forgotpassword/i }))
    expect(onForgot).toHaveBeenCalled()
  })
})

describe('RequestOtpStep', () => {
  it('renders and sends OTP', async () => {
    const onSend = vi.fn()
    const onBack = vi.fn()
    renderWithProviders(
      <RequestOtpStep
        resetEmail="a@b.c"
        setResetEmail={() => {}}
        loading={false}
        onBack={onBack}
        onSend={onSend}
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button')[1]) // send (back is first)
    expect(onSend).toHaveBeenCalled()
    await user.click(screen.getAllByRole('button')[0]) // back
    expect(onBack).toHaveBeenCalled()
  })

  it('shows loading state', () => {
    renderWithProviders(
      <RequestOtpStep
        resetEmail="a@b.c"
        setResetEmail={() => {}}
        loading
        onBack={() => {}}
        onSend={() => {}}
      />,
    )
    expect(screen.getAllByRole('button')[1]).toBeDisabled()
  })

  it('uses fallback yourEmail when resetEmail empty', () => {
    renderWithProviders(
      <RequestOtpStep
        resetEmail=""
        setResetEmail={() => {}}
        loading={false}
        onBack={() => {}}
        onSend={() => {}}
      />,
    )
    expect(screen.getByText(/your email/i)).toBeInTheDocument()
  })

  it('typing updates email', async () => {
    const setEmail = vi.fn()
    renderWithProviders(
      <RequestOtpStep
        resetEmail=""
        setResetEmail={setEmail}
        loading={false}
        onBack={() => {}}
        onSend={() => {}}
      />,
    )
    await userEvent.setup().type(screen.getByPlaceholderText(/you@yourrestaurant/i), 'a')
    expect(setEmail).toHaveBeenCalled()
  })
})

describe('VerifyOtpStep', () => {
  it('renders countdown and back', async () => {
    const onBack = vi.fn()
    renderWithProviders(
      <VerifyOtpStep
        otp=""
        setOtp={() => {}}
        countdown={30}
        resetEmail="a@b.c"
        onBack={onBack}
        onVerify={() => {}}
        onResend={() => {}}
      />,
    )
    expect(screen.getByText(/Resend in/i)).toBeInTheDocument()
    await userEvent.setup().click(screen.getAllByRole('button')[0])
    expect(onBack).toHaveBeenCalled()
  })

  it('resend when countdown is 0', async () => {
    const onResend = vi.fn()
    renderWithProviders(
      <VerifyOtpStep
        otp=""
        setOtp={() => {}}
        countdown={0}
        resetEmail="a@b.c"
        onBack={() => {}}
        onVerify={() => {}}
        onResend={onResend}
      />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: /Resend code/i }))
    expect(onResend).toHaveBeenCalled()
  })

  it('resend is reachable and activatable by keyboard alone', async () => {
    const onResend = vi.fn()
    renderWithProviders(
      <VerifyOtpStep
        otp=""
        setOtp={() => {}}
        countdown={0}
        resetEmail="a@b.c"
        onBack={() => {}}
        onVerify={() => {}}
        onResend={onResend}
      />,
    )
    const user = userEvent.setup()
    const resend = screen.getByRole('button', { name: /Resend code/i })
    resend.focus()
    expect(resend).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onResend).toHaveBeenCalledTimes(1)
    await user.keyboard(' ')
    expect(onResend).toHaveBeenCalledTimes(2)
  })

  it('verify enabled when otp full', async () => {
    const onVerify = vi.fn()
    renderWithProviders(
      <VerifyOtpStep
        otp="123456"
        setOtp={() => {}}
        countdown={0}
        resetEmail=""
        onBack={() => {}}
        onVerify={onVerify}
        onResend={() => {}}
      />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: /verify code/i }))
    expect(onVerify).toHaveBeenCalled()
  })

  it('uses the caller submit label when the step does not verify the code', () => {
    renderWithProviders(
      <VerifyOtpStep
        otp="123456"
        setOtp={() => {}}
        countdown={0}
        resetEmail=""
        onBack={() => {}}
        onVerify={() => {}}
        onResend={() => {}}
        submitLabel="Continue"
      />,
    )
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /verify code/i })).not.toBeInTheDocument()
  })
})

describe('NewPasswordStep', () => {
  it('renders empty state', () => {
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
    expect(screen.getByRole('button', { name: /save new password/i })).toBeDisabled()
  })

  it('shows mismatch error', () => {
    renderWithProviders(
      <NewPasswordStep
        newPw="Abc12345"
        setNewPw={() => {}}
        confirmPw="Different"
        setConfirmPw={() => {}}
        loading={false}
        onSave={() => {}}
      />,
    )
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
  })

  it('save enabled when valid; clicking triggers onSave', async () => {
    const onSave = vi.fn()
    renderWithProviders(
      <NewPasswordStep
        newPw="Abcdef12!"
        setNewPw={() => {}}
        confirmPw="Abcdef12!"
        setConfirmPw={() => {}}
        loading={false}
        onSave={onSave}
      />,
    )
    const btn = screen.getByRole('button', { name: /save new password/i })
    expect(btn).not.toBeDisabled()
    await userEvent.setup().click(btn)
    expect(onSave).toHaveBeenCalled()
  })

  it('loading state', () => {
    renderWithProviders(
      <NewPasswordStep
        newPw="Abc1!ghi"
        setNewPw={() => {}}
        confirmPw="Abc1!ghi"
        setConfirmPw={() => {}}
        loading
        onSave={() => {}}
      />,
    )
    expect(screen.getByText(/saving/i)).toBeInTheDocument()
  })

  it('typing updates both passwords', async () => {
    const setNew = vi.fn()
    const setConfirm = vi.fn()
    renderWithProviders(
      <NewPasswordStep
        newPw=""
        setNewPw={setNew}
        confirmPw=""
        setConfirmPw={setConfirm}
        loading={false}
        onSave={() => {}}
      />,
    )
    const inputs = document.querySelectorAll('input')
    await userEvent.setup().type(inputs[0] as HTMLInputElement, 'a')
    await userEvent.setup().type(inputs[1] as HTMLInputElement, 'b')
    expect(setNew).toHaveBeenCalled()
    expect(setConfirm).toHaveBeenCalled()
  })
})

describe('SuccessStep', () => {
  it('renders and triggers onBack', async () => {
    const onBack = vi.fn()
    renderWithProviders(<SuccessStep onBack={onBack} />)
    await userEvent.setup().click(screen.getByRole('button'))
    expect(onBack).toHaveBeenCalled()
  })
})
