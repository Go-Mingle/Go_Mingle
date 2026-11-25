import { useState } from 'react'
import { Grid, Input } from 'antd'
import { ArrowLeft, DeviceMobile, Key } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { OtpInput } from './OtpInput'
import { authLinkClass } from './authStyles'

interface Props {
  onBack: () => void
  onVerify: (code: string) => void
  error?: string
  loading?: boolean
}

/**
 * Second sign-in step (GM-346): the 6-digit code from the authenticator app,
 * or one of the admin's backup codes when the phone isn't at hand.
 */
export function TwoStepCodeStep({ onBack, onVerify, error, loading }: Props) {
  const { t } = useTranslation('auth')
  const isMobile = !Grid.useBreakpoint().md
  const [useBackup, setUseBackup] = useState(false)
  const [code, setCode] = useState('')
  const [backup, setBackup] = useState('')
  const ready = useBackup ? backup.replace(/[^a-z0-9]/gi, '').length === 8 : code.length === 6

  const submit = () => {
    if (ready && !loading) onVerify(useBackup ? backup.trim() : code)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      data-testid="two-step-step"
    >
      <button
        type="button"
        onClick={onBack}
        className={`-ml-1 mb-5 flex items-center gap-1.5 ${authLinkClass(isMobile)}`}
      >
        <ArrowLeft size={14} /> {t('twoStep.back')}
      </button>
      <h2 className="mb-2 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-text)]">
        {t('twoStep.title')}
      </h2>
      <p className="mb-6 text-[14px] text-[var(--color-text-muted)]">
        {useBackup ? t('twoStep.backupSubtitle') : t('twoStep.subtitle')}
      </p>
      <div className="space-y-5">
        {useBackup ? (
          <Input
            size="large"
            value={backup}
            onChange={(e) => setBackup(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX"
            maxLength={9}
            autoFocus
            autoComplete="one-time-code"
            aria-label={t('twoStep.backupLabel')}
            data-testid="two-step-backup"
            className="font-mono tracking-[0.2em]"
          />
        ) : (
          <OtpInput
            value={code}
            onChange={(v) => {
              setCode(v)
              // Six digits typed or pasted: sign in without another click.
              if (v.length === 6 && !loading) onVerify(v)
            }}
          />
        )}
        {error && (
          <p className="mt-2 text-[12px] text-[var(--color-error)]" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!ready || loading}
          data-testid="two-step-verify"
          className="btn-primary h-11 w-full rounded-[12px] text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('twoStep.verify')}
        </button>
        <button
          type="button"
          onClick={() => {
            setUseBackup((v) => !v)
            setCode('')
            setBackup('')
          }}
          className={`flex w-full items-center justify-center gap-1.5 border-none bg-transparent ${authLinkClass(isMobile)}`}
        >
          {useBackup ? <DeviceMobile size={14} aria-hidden /> : <Key size={14} aria-hidden />}
          {useBackup ? t('twoStep.useApp') : t('twoStep.useBackup')}
        </button>
      </div>
    </form>
  )
}
