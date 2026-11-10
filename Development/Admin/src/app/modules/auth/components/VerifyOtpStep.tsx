import { Grid } from 'antd'
import { ArrowLeft } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { OtpInput } from './OtpInput'
import { authLinkClass } from './authStyles'

interface VerifyOtpStepProps {
  otp: string
  setOtp: (v: string) => void
  countdown: number
  resetEmail: string
  onBack: () => void
  onVerify: () => void
  onResend: () => void
  error?: string
  loading?: boolean
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
}: VerifyOtpStepProps) {
  const { t } = useTranslation('auth')
  const isMobile = !Grid.useBreakpoint().md
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className={`flex items-center gap-1.5 mb-5 -ml-1 ${authLinkClass(isMobile)}`}
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
        {error && <p className="text-[12px] text-[var(--color-error)] mt-2">{error}</p>}
        <button
          type="button"
          onClick={onVerify}
          disabled={otp.length !== 6 || loading}
          className="btn-primary w-full h-11 rounded-[12px] text-white font-semibold text-[14px] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {t('verifyOtp.verifyCode')}
        </button>
        <p className="text-center text-[12px]">
          {countdown > 0 ? (
            <span className="text-[var(--color-text-muted)]">
              {t('verifyOtp.resendIn', { count: countdown })}
            </span>
          ) : (
            <span
              className={`text-[var(--color-accent)] cursor-pointer${
                isMobile ? '' : ' hover:underline'
              }`}
              onClick={onResend}
            >
              {t('verifyOtp.resendCode')}
            </span>
          )}
        </p>
      </div>
    </>
  )
}
