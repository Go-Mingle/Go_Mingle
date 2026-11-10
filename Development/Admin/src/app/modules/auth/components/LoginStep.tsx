import { Form, Grid, Input } from 'antd'
import { Envelope as Mail, Lock, WarningCircle } from '@phosphor-icons/react'
import { emailValidatorRule } from '../../../../shared/utils/email'

const labelClass =
  'text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]'

interface LoginStepProps {
  loading: boolean
  loginError: string
  lockoutRemaining: number
  formatLockoutTime: (secs: number) => string
  onForgotPassword: () => void
  t: (k: string, opts?: Record<string, unknown>) => string
  demoEmail?: string
  demoPassword?: string
}

export function LoginStep({
  loading,
  loginError,
  lockoutRemaining,
  formatLockoutTime,
  onForgotPassword,
  t,
  demoEmail,
  demoPassword,
}: LoginStepProps) {
  const isLocked = lockoutRemaining > 0
  const isMobile = !Grid.useBreakpoint().md

  return (
    <>
      <h1 className="text-[24px] font-bold text-[var(--color-text)] mb-1 font-[var(--font-display)]">
        {t('welcomeBack')}
      </h1>
      <p className="text-[14px] text-[var(--color-text-muted)] mb-6">{t('portalSubtitle')}</p>

      {demoEmail && demoPassword && (
        <div className="mb-5 px-3.5 py-2.5 bg-(--color-accent-light) border border-(--color-accent-mid) rounded-lg text-[12px] text-accent-dark leading-relaxed">
          <strong>Demo credentials</strong>
          <br />
          Email: <code className="font-mono">{demoEmail}</code>
          <br />
          Password: <code className="font-mono">{demoPassword}</code>
        </div>
      )}

      {/* Lockout banner */}
      {isLocked && (
        <div className="mb-5 flex items-start gap-2.5 px-3.5 py-3 bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-lg">
          <WarningCircle
            size={18}
            weight="fill"
            className="text-[var(--color-error)] shrink-0 mt-0.5"
          />
          <div>
            <p className="text-[13px] font-semibold text-[var(--color-error)] m-0">
              {t('lockout.title')}
            </p>
            <p className="text-[12px] text-[var(--color-error)] m-0 mt-0.5">
              {t('lockout.message', { time: formatLockoutTime(lockoutRemaining) })}
            </p>
          </div>
        </div>
      )}

      <Form.Item
        label={<span className={labelClass}>{t('email')}</span>}
        name="email"
        rules={[
          { required: true, message: t('errors.invalidEmail') },
          emailValidatorRule(t('errors.invalidEmail')),
        ]}
      >
        <Input
          type="email"
          placeholder={t('emailPlaceholder')}
          size="large"
          autoComplete="email"
          disabled={isLocked || loading}
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
          disabled={isLocked || loading}
          prefix={<Lock size={15} className="text-[var(--color-text-subtle)]" />}
        />
      </Form.Item>

      {loginError && !isLocked && (
        <p className="text-[13px] text-[var(--color-error)] -mt-2 mb-4">{loginError}</p>
      )}

      <div className="flex justify-end -mt-1 mb-5">
        <button
          type="button"
          onClick={onForgotPassword}
          disabled={isLocked}
          className={`text-[13px] text-[var(--color-accent)] disabled:opacity-40 disabled:cursor-not-allowed${
            isMobile ? '' : ' hover:underline'
          }`}
        >
          {t('forgotPassword')}
        </button>
      </div>

      <Form.Item className="mb-0">
        <button
          type="submit"
          disabled={loading || isLocked}
          className="btn-primary w-full h-11 rounded-[12px] text-white font-semibold text-[14px] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? t('common:status.loading') : t('signIn')}
        </button>
      </Form.Item>
    </>
  )
}
