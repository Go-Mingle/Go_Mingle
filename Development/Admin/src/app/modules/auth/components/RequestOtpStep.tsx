import { Grid, Input } from 'antd'
import { Envelope as Mail, ArrowLeft } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { authLinkClass } from './authStyles'

interface RequestOtpStepProps {
  resetEmail: string
  setResetEmail: (v: string) => void
  loading: boolean
  onBack: () => void
  onSend: () => void
  error?: string
}

export function RequestOtpStep({
  resetEmail,
  setResetEmail,
  loading,
  onBack,
  onSend,
  error,
}: RequestOtpStepProps) {
  const { t } = useTranslation('auth')
  const isMobile = !Grid.useBreakpoint().md
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className={`flex items-center gap-1.5 mb-5 -ml-1 ${authLinkClass(isMobile)}`}
      >
        <ArrowLeft size={14} /> {t('resetPassword.backToSignIn')}
      </button>
      <h2 className="text-[22px] font-bold text-[var(--color-text)] mb-2 font-[var(--font-display)]">
        {t('resetPassword.title')}
      </h2>
      <p className="text-[14px] text-[var(--color-text-muted)] mb-6">
        {t('resetPassword.subtitle', {
          email: resetEmail || t('resetPassword.yourEmail'),
        })}
      </p>
      <div className="space-y-3">
        <Input
          size="large"
          value={resetEmail}
          onChange={(e) => setResetEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          prefix={<Mail size={15} className="text-[var(--color-text-subtle)]" />}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={loading || !resetEmail.trim()}
          className="btn-primary w-full h-11 rounded-[12px] text-white font-semibold text-[14px] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? t('resetPassword.sending') : t('resetPassword.sendCode')}
        </button>
        {error && <p className="text-[12px] text-[var(--color-error)] mt-2">{error}</p>}
      </div>
    </>
  )
}
