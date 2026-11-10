import { Form, Input } from 'antd'
import { Envelope as Mail, Lock, WarningCircle } from '@phosphor-icons/react'

const labelClass =
  'text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]'

interface LoginStepProps {
  loading: boolean
  loginError: string
  onForgotPassword: () => void
  onSignUp?: () => void
  t: (k: string, opts?: Record<string, unknown>) => string
  demoEmail?: string
  demoPassword?: string
}

export function LoginStep({
  loading,
  loginError,
  onForgotPassword,
  onSignUp,
  t,
  demoEmail,
  demoPassword,
}: Readonly<LoginStepProps>) {
  return (
    <>
      <h1 className="text-[24px] font-bold text-[var(--color-text)] mb-1 font-[var(--font-display)]">
        {t('welcomeBack')}
      </h1>
      <p className="text-[14px] text-[var(--color-text-muted)] mb-6">{t('portalSubtitle')}</p>

      {demoEmail && demoPassword && (
        <div className="mb-5 px-3.5 py-2.5 bg-[var(--color-accent-light)] border border-[var(--color-accent-mid)] rounded-lg text-[12px] text-[var(--color-accent-dark)] leading-relaxed">
          <strong>Demo credentials</strong>
          <br />
          Email: <code className="font-mono">{demoEmail}</code>
          <br />
          Password: <code className="font-mono">{demoPassword}</code>
        </div>
      )}

      {/*
        One banner for every sign-in failure. Lockout and suspension copy is
        authored by the Pre-Auth Lambda and shown verbatim — the client never
        derives an attempts-remaining hint, because suspension rejections do not
        increment the lockout counter, so any such count would be wrong.
      */}
      {loginError && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 px-3.5 py-3 bg-[var(--color-error-bg)] border border-[var(--color-error)] rounded-lg"
        >
          <WarningCircle
            size={18}
            weight="fill"
            className="text-[var(--color-error)] shrink-0 mt-0.5"
          />
          <p className="text-[13px] text-[var(--color-error)] m-0">{loginError}</p>
        </div>
      )}

      <Form.Item
        label={<span className={labelClass}>{t('email')}</span>}
        name="email"
        rules={[{ required: true, type: 'email', message: t('errors.invalidEmail') }]}
      >
        <Input
          type="email"
          placeholder={t('emailPlaceholder')}
          size="large"
          autoComplete="email"
          prefix={<Mail size={15} className="text-[var(--color-text-subtle)]" />}
        />
      </Form.Item>
      <Form.Item
        label={<span className={labelClass}>{t('password')}</span>}
        name="password"
        rules={[{ required: true, message: t('errors.enterPassword') }]}
      >
        <Input.Password
          placeholder={t('passwordPlaceholder')}
          size="large"
          autoComplete="current-password"
          prefix={<Lock size={15} className="text-[var(--color-text-subtle)]" />}
        />
      </Form.Item>

      <div className="flex justify-end -mt-1 mb-5">
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-[13px] font-medium text-[var(--color-accent)] md:hover:underline"
        >
          {t('forgotPassword')}
        </button>
      </div>

      <Form.Item className="mb-0">
        <button
          type="submit"
          disabled={loading}
          className="btn-coral w-full h-11 rounded-[12px] text-white font-semibold text-[14px] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? t('common:status.loading') : t('signIn')}
        </button>
      </Form.Item>

      <p className="text-center text-[13px] text-[var(--color-text-muted)] mt-5">
        {t('noAccount')}{' '}
        <button
          type="button"
          onClick={() => onSignUp?.()}
          className="text-[13px] text-[var(--color-accent)] font-medium md:hover:underline"
        >
          {t('createAccount')}
        </button>
      </p>
    </>
  )
}
