import { Input } from 'antd'
import { Envelope as Mail, ArrowLeft } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AuthFormError } from './AuthFormError'

interface EmailStepProps {
  email: string
  setEmail: (v: string) => void
  loading: boolean
  onSendOtp: () => void
  /** Inline validation / API error shown under the field. */
  error?: string
  /**
   * MET-1280 — shown only once `start` has refused the address (a throttle, or
   * the 500 an address with prior failed verifications draws). A code from an
   * earlier `start` may still be in the inbox and `verify` accepts it, so this
   * is the partner's own way out of what is otherwise a dead end: the address is
   * neither registered enough to sign in with nor usable enough to sign up with.
   */
  canEnterExistingCode?: boolean
  onEnterExistingCode?: () => void
}

export function EmailStep({
  email,
  setEmail,
  loading,
  onSendOtp,
  error,
  canEnterExistingCode,
  onEnterExistingCode,
}: Readonly<EmailStepProps>) {
  const { t } = useTranslation(['auth', 'common'])
  return (
    <>
      <Link
        to="/login"
        className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-accent)] mb-5 -ml-1 transition-colors md:hover:underline"
      >
        <ArrowLeft size={14} /> {t('signUp.backToSignIn')}
      </Link>
      <h1 className="text-[24px] font-bold text-[var(--color-text)] mb-2 font-[var(--font-display)]">
        {t('signUp.title')}
      </h1>
      <p className="text-[14px] text-[var(--color-text-muted)] mb-6">{t('signUp.subtitle')}</p>
      <div className="space-y-3">
        <Input
          size="large"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onPressEnter={onSendOtp}
          placeholder={t('emailPlaceholder')}
          prefix={<Mail size={15} className="text-[var(--color-text-subtle)]" />}
          status={error ? 'error' : undefined}
        />
        <AuthFormError message={error} />
        <button
          type="button"
          onClick={onSendOtp}
          disabled={loading || !email.trim()}
          className="btn-coral w-full h-11 rounded-[12px] text-white font-semibold text-[14px] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? t('signUp.sending') : t('signUp.sendCode')}
        </button>
        {canEnterExistingCode && (
          <button
            type="button"
            onClick={onEnterExistingCode}
            className="w-full text-[13px] font-medium text-[var(--color-accent)] md:hover:underline"
          >
            {t('signUp.enterExistingCode')}
          </button>
        )}
      </div>
      <p className="text-center text-[13px] text-[var(--color-text-muted)] mt-6">
        {t('signUp.haveAccount')}{' '}
        <Link
          to="/login"
          className="text-[13px] text-[var(--color-accent)] font-medium md:hover:underline"
        >
          {t('signIn')}
        </Link>
      </p>
    </>
  )
}
