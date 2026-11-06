import { ArrowLeft } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { OtpInput } from './OtpInput'
import { AuthFormError } from './AuthFormError'

interface VerifyOtpStepProps {
  otp: string
  setOtp: (v: string) => void
  countdown: number
  resetEmail: string
  onBack: () => void
  onVerify: () => void
  onResend: () => void
  /** Inline error — the backend sends the exact wording for wrong vs expired codes. */
  error?: string
  loading?: boolean
  /**
   * Primary button copy. Signup checks the code on this step, so it keeps the
   * default "Verify code". Reset cannot — Cognito takes the code and the new
   * password in one call — so it passes "Continue" rather than promising a
   * check that only happens a step later (MET-1245).
   */
  submitLabel?: string
}

export function VerifyOtpStep({
  otp,
  setOtp,
  countdown,
  resetEmail,
  onBack,
  onVerify,
  onResend,
  error,
  loading,
  submitLabel,
}: Readonly<VerifyOtpStepProps>) {
  const { t } = useTranslation('auth')
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-accent)] mb-5 -ml-1 transition-colors md:hover:underline"
      >
        <ArrowLeft size={14} /> {t('verifyOtp.back')}
      </button>
      <h2 className="text-[22px] font-bold text-[var(--color-text)] mb-2 font-[var(--font-display)]">
        {t('verifyOtp.title')}
      </h2>
      <p className="text-[14px] text-[var(--color-text-muted)] mb-6">
        {t('verifyOtp.subtitle', { email: resetEmail })}
      </p>
      <div className="space-y-5">
        <OtpInput value={otp} onChange={setOtp} />
        <AuthFormError message={error} centered />
        <button
          type="button"
          onClick={onVerify}
          disabled={otp.length !== 6 || loading}
          className="btn-coral w-full h-11 rounded-[12px] text-white font-semibold text-[14px] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitLabel ?? t('verifyOtp.verifyCode')}
        </button>
        <p className="text-center text-[12px]">
          {countdown > 0 ? (
            <span className="text-[var(--color-text-muted)]">
              {t('verifyOtp.resendIn', { count: countdown })}
            </span>
          ) : (
            // A real button: resending is the only way out of an expired code,
            // so it has to be reachable by keyboard and announced as an action.
            <button
              type="button"
              onClick={onResend}
              className="text-[12px] text-[var(--color-accent)] cursor-pointer md:hover:underline"
            >
              {t('verifyOtp.resendCode')}
            </button>
          )}
        </p>
      </div>
    </>
  )
}
