import type { CSSProperties } from 'react'
import { Input } from 'antd'
import { Lock, CheckCircle as CheckCircle2 } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import {
  getStrength,
  meetsPasswordPolicy,
  STRENGTH_COLORS,
} from '../../../../shared/utils/passwordStrength'
import { AuthFormError } from './AuthFormError'

const labelClass =
  'text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]'

interface NewPasswordStepProps {
  newPw: string
  setNewPw: (v: string) => void
  confirmPw: string
  setConfirmPw: (v: string) => void
  loading: boolean
  onSave: () => void
  /** Inline error from the completion call (policy rejection, expired proof, …). */
  error?: string
}

export function NewPasswordStep({
  newPw,
  setNewPw,
  confirmPw,
  setConfirmPw,
  loading,
  onSave,
  error,
}: Readonly<NewPasswordStepProps>) {
  const { t } = useTranslation('auth')
  const STRENGTH_LABELS = [
    t('newPassword.strengthWeak'),
    t('newPassword.strengthFair'),
    t('newPassword.strengthGood'),
    t('newPassword.strengthStrong'),
  ]
  const pwStrength = getStrength(newPw)
  return (
    <>
      <h2 className="text-[22px] font-bold text-[var(--color-text)] mb-2 font-[var(--font-display)]">
        {t('newPassword.title')}
      </h2>
      <p className="text-[14px] text-[var(--color-text-muted)] mb-6">{t('newPassword.subtitle')}</p>
      <div className="space-y-4">
        <div>
          <label className={`${labelClass} block mb-1.5`}>{t('newPassword.label')}</label>
          <Input.Password
            size="large"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            prefix={<Lock size={15} className="text-[var(--color-text-subtle)]" />}
            placeholder={t('newPassword.placeholder')}
          />
          <p className="text-[12px] text-[var(--color-text-muted)] mt-1.5">
            {t('newPassword.requirements')}
          </p>
          {newPw.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex-1 h-1 rounded-[4px] transition-colors duration-200 bg-[var(--seg-color)]"
                    style={
                      {
                        '--seg-color':
                          i < pwStrength ? STRENGTH_COLORS[pwStrength - 1] : 'var(--color-border)',
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
              <p
                className="text-[11px] font-medium text-[var(--lbl-color)]"
                style={
                  {
                    '--lbl-color':
                      pwStrength > 0 ? STRENGTH_COLORS[pwStrength - 1] : 'var(--color-text-muted)',
                  } as CSSProperties
                }
              >
                {pwStrength > 0 ? STRENGTH_LABELS[pwStrength - 1] : t('newPassword.enterPassword')}
              </p>
            </div>
          )}
        </div>
        <div>
          <label className={`${labelClass} block mb-1.5`}>{t('newPassword.confirmLabel')}</label>
          <Input.Password
            size="large"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            prefix={<Lock size={15} className="text-[var(--color-text-subtle)]" />}
            placeholder={t('newPassword.confirmPlaceholder')}
            status={confirmPw && confirmPw !== newPw ? 'error' : undefined}
          />
          {confirmPw && confirmPw !== newPw && (
            <p className="text-[12px] text-[var(--color-error)] mt-1">
              {t('newPassword.mismatch')}
            </p>
          )}
        </div>
        <AuthFormError message={error} />
        <button
          type="button"
          onClick={onSave}
          // Gate on the real policy, not the meter. The meter scores short
          // passwords that happen to mix character classes highly enough to
          // pass a score check, which the backend would then reject with 422.
          disabled={loading || !meetsPasswordPolicy(newPw) || !confirmPw || newPw !== confirmPw}
          className="btn-coral w-full h-11 rounded-[12px] text-white font-semibold text-[14px] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? t('newPassword.saving') : t('newPassword.save')}
        </button>
      </div>
    </>
  )
}

interface SuccessStepProps {
  onBack: () => void
}

export function SuccessStep({ onBack }: SuccessStepProps) {
  const { t } = useTranslation('auth')
  return (
    <div className="flex flex-col items-center text-center py-4">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5 bg-[var(--color-success-bg)]">
        <CheckCircle2 size={32} className="text-[var(--color-success)]" />
      </div>
      <h2 className="text-[22px] font-bold text-[var(--color-text)] mb-2 font-[var(--font-display)]">
        {t('success.title')}
      </h2>
      <p className="text-[14px] text-[var(--color-text-muted)] mb-7 max-w-[320px]">
        {t('success.subtitle')}
      </p>
      <button
        type="button"
        onClick={onBack}
        className="btn-coral w-full h-11 rounded-[12px] text-white font-semibold text-[14px]"
      >
        {t('success.backToSignIn')}
      </button>
    </div>
  )
}
