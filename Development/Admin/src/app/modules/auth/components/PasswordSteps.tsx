import { Input } from 'antd'
import { Lock, CheckCircle as CheckCircle2 } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { getStrength, STRENGTH_COLORS } from '../../../../shared/utils/passwordStrength'

const labelClass =
  'text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]'

interface NewPasswordStepProps {
  newPw: string
  setNewPw: (v: string) => void
  confirmPw: string
  setConfirmPw: (v: string) => void
  loading: boolean
  onSave: () => void
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
}: NewPasswordStepProps) {
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
          {newPw.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex-1 h-1 rounded-[2px] transition-colors duration-200"
                    style={{
                      backgroundColor:
                        i < pwStrength ? STRENGTH_COLORS[pwStrength - 1] : 'var(--color-border)',
                    }}
                  />
                ))}
              </div>
              <p
                className="text-[11px] font-medium"
                style={{
                  color:
                    pwStrength > 0 ? STRENGTH_COLORS[pwStrength - 1] : 'var(--color-text-muted)',
                }}
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
        <button
          type="button"
          onClick={onSave}
          disabled={loading || pwStrength < 2 || !confirmPw || newPw !== confirmPw}
          className="btn-primary w-full h-11 rounded-[12px] text-white font-semibold text-[14px] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? t('newPassword.saving') : t('newPassword.save')}
        </button>
        {error && <p className="text-[12px] text-[var(--color-error)] mt-2">{error}</p>}
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
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
        style={{ backgroundColor: 'var(--color-success-bg)' }}
      >
        <CheckCircle2 size={32} style={{ color: 'var(--color-success)' }} />
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
        className="btn-primary w-full h-11 rounded-[12px] text-white font-semibold text-[14px]"
      >
        {t('success.backToSignIn')}
      </button>
    </div>
  )
}
