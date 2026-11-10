import { GoMingleLogo } from '../../atoms/GoMingleLogo'
import { AuthThemeScope } from './components/AuthThemeScope'
import { BrandPanel } from './components/BrandPanel'
import { EmailStep } from './components/EmailStep'
import { VerifyOtpStep } from './components/VerifyOtpStep'
import { NewPasswordStep } from './components/PasswordSteps'
import { useSignUpFlow } from './hooks/useSignUpFlow'

/**
 * Self-serve partner sign-up (email → OTP → password). On completion the partner
 * account is activated in Draft status, signed in, and routed to profile setup
 * so they can complete their restaurant profile and submit it for review.
 * (UI prototype — OTP delivery/validation come with the backend.)
 */
export function SignUpPage() {
  const {
    contextHolder,
    step,
    email,
    setEmail,
    otp,
    setOtp,
    countdown,
    newPw,
    setNewPw,
    confirmPw,
    setConfirmPw,
    loading,
    stepError,
    canEnterExistingCode,
    handleSendOtp,
    handleVerifyOtp,
    handleCreateAccount,
    backToEmail,
    resendOtp,
    enterExistingCode,
  } = useSignUpFlow()

  return (
    <AuthThemeScope>
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
        {contextHolder}
        <div className="hidden lg:block">
          <BrandPanel />
        </div>

        <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12 bg-[var(--color-page)]">
          <div className="w-full max-w-[440px]">
            <div className="flex justify-center mb-8">
              <GoMingleLogo collapsed={false} />
            </div>

            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[12px] p-8 shadow-[var(--shadow-md)]">
              {step === 'email' && (
                <EmailStep
                  email={email}
                  setEmail={setEmail}
                  loading={loading}
                  onSendOtp={handleSendOtp}
                  error={stepError}
                  canEnterExistingCode={canEnterExistingCode}
                  onEnterExistingCode={enterExistingCode}
                />
              )}

              {step === 'otp' && (
                <VerifyOtpStep
                  otp={otp}
                  setOtp={setOtp}
                  countdown={countdown}
                  resetEmail={email}
                  onBack={backToEmail}
                  onVerify={handleVerifyOtp}
                  onResend={resendOtp}
                  error={stepError}
                  loading={loading}
                />
              )}

              {step === 'password' && (
                <NewPasswordStep
                  newPw={newPw}
                  setNewPw={setNewPw}
                  confirmPw={confirmPw}
                  setConfirmPw={setConfirmPw}
                  loading={loading}
                  onSave={handleCreateAccount}
                  error={stepError}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthThemeScope>
  )
}
