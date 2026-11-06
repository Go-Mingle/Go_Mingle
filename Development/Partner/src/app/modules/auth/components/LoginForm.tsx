import { Form } from 'antd'
import { GoMingleLogo } from '../../../atoms/GoMingleLogo'
import { useLoginForm } from '../hooks/useLoginForm'
import {
  LoginStep,
  RequestOtpStep,
  VerifyOtpStep,
  NewPasswordStep,
  SuccessStep,
} from './LoginSteps'

function LoginStepsSwitch({
  t,
  navigate,
  step,
  setStep,
  loading,
  loginError,
  resetError,
  form,
  onFinish,
  handleForgotPassword,
  resetEmail,
  setResetEmail,
  handleSendOtp,
  otp,
  setOtp,
  countdown,
  handleVerifyOtp,
  newPw,
  setNewPw,
  confirmPw,
  setConfirmPw,
  handleSavePassword,
  resetToLogin,
  showDemoCredentials,
  DEMO_EMAIL,
  DEMO_PASSWORD,
}: ReturnType<typeof useLoginForm>) {
  return (
    <>
      {step === 'login' && (
        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <LoginStep
            loading={loading}
            loginError={loginError}
            onForgotPassword={handleForgotPassword}
            onSignUp={() => navigate('/signup')}
            t={t}
            demoEmail={showDemoCredentials ? DEMO_EMAIL : undefined}
            demoPassword={showDemoCredentials ? DEMO_PASSWORD : undefined}
          />
        </Form>
      )}

      {step === 'request-otp' && (
        <RequestOtpStep
          resetEmail={resetEmail}
          setResetEmail={setResetEmail}
          loading={loading}
          error={resetError}
          onBack={() => setStep('login')}
          onSend={handleSendOtp}
        />
      )}

      {step === 'verify-otp' && (
        <VerifyOtpStep
          otp={otp}
          setOtp={setOtp}
          countdown={countdown}
          resetEmail={resetEmail}
          onBack={() => setStep('request-otp')}
          onVerify={handleVerifyOtp}
          error={resetError}
          loading={loading}
          submitLabel={t('verifyOtp.continue')}
          onResend={() => {
            setOtp('')
            void handleSendOtp()
          }}
        />
      )}

      {step === 'new-password' && (
        <NewPasswordStep
          newPw={newPw}
          setNewPw={setNewPw}
          confirmPw={confirmPw}
          setConfirmPw={setConfirmPw}
          loading={loading}
          onSave={handleSavePassword}
          error={resetError}
        />
      )}

      {step === 'success' && <SuccessStep onBack={resetToLogin} />}
    </>
  )
}

export function LoginForm() {
  const state = useLoginForm()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12 bg-[var(--color-page)]">
      <div className="w-full max-w-[440px]">
        <div className="flex justify-center mb-8">
          <GoMingleLogo collapsed={false} />
        </div>

        <div className="bg-white border border-[var(--color-border)] rounded-[12px] p-8 shadow-[var(--shadow-md)]">
          <LoginStepsSwitch {...state} />
        </div>
      </div>
    </div>
  )
}
