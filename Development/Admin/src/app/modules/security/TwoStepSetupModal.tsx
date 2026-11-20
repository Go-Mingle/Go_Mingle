import { useState } from 'react'
import { Alert, Input, Modal, Steps, message } from 'antd'
import { ArrowSquareOut, Copy, DownloadSimple } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../atoms/AppButton'
import { ModalActions, PrimaryActionButton } from '../../atoms/ModalActions'
import { MODAL_WIDTH } from '../../atoms/modalWidth'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import { downloadBlob } from '../../../shared/utils/csvExport'
import { groupSecret, securityService } from './services'
import { SetupQr } from './SetupQr'

interface Props {
  open: boolean
  email: string
  onClose: () => void
  onDone: () => void
}

/**
 * Turning on two-step sign-in: add the key to an authenticator app, confirm
 * with its first code, then save the ten backup codes (shown only once).
 */
export function TwoStepSetupModal({ open, email, onClose, onDone }: Props) {
  const { t } = useTranslation('security')
  const [messageApi, holder] = message.useMessage()
  const [step, setStep] = useState(0)
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null)
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const start = async () => {
    setBusy(true)
    setError('')
    try {
      setSetup(await securityService.beginSetup())
      setStep(1)
    } catch (e) {
      setError(getApiErrorMessage(e, t('errors.generic')))
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await securityService.enable(code.replace(/\s/g, ''))
      setCodes(res.backupCodes)
      setStep(2)
    } catch (e) {
      setError(getApiErrorMessage(e, t('errors.wrongCode')))
    } finally {
      setBusy(false)
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      void messageApi.success(t('setup.copied'))
    } catch {
      void messageApi.info(text)
    }
  }

  const downloadCodes = () => {
    const body = [t('setup.fileTitle'), email, '', ...codes, '', t('setup.fileNote')].join('\r\n')
    downloadBlob('gomingle-admin-backup-codes.txt', new Blob([body], { type: 'text/plain' }))
    setSaved(true)
  }

  const close = () => {
    if (step === 2) onDone()
    onClose()
  }

  return (
    <Modal
      open={open}
      onCancel={close}
      maskClosable={step !== 2}
      width={MODAL_WIDTH.large}
      destroyOnHidden
      afterOpenChange={(v) => v && step === 0 && !setup && void start()}
      title={<span className="text-[18px] font-semibold">{t('setup.title')}</span>}
      footer={
        step === 1 ? (
          <ModalActions
            onCancel={close}
            onConfirm={() => void confirm()}
            confirmLabel={t('setup.turnOn')}
            confirmDisabled={code.replace(/\s/g, '').length !== 6}
            isLoading={busy}
          />
        ) : step === 2 ? (
          <div className="flex justify-end">
            <PrimaryActionButton onClick={close} disabled={!saved} data-testid="two-step-finish">
              {t('setup.done')}
            </PrimaryActionButton>
          </div>
        ) : null
      }
    >
      {holder}
      <div className="mb-5">
        <Steps
          size="small"
          current={step}
          items={[
            { title: t('setup.stepApp') },
            { title: t('setup.stepCode') },
            { title: t('setup.stepBackup') },
          ]}
        />
      </div>
      {error && <Alert className="mb-4" type="error" showIcon message={error} />}

      {step < 2 && (
        <div className="flex flex-col gap-4" data-testid="two-step-setup">
          <p className="m-0 text-[14px] text-[var(--color-text-secondary)]">{t('setup.intro')}</p>
          {setup && (
            <>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <SetupQr url={setup.otpauthUrl} />
                <p className="m-0 text-[13px] text-[var(--color-text-secondary)]">
                  {t('setup.scan')}
                </p>
              </div>
              <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-hover-neutral)] p-4">
                <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                  {t('setup.keyLabel')}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <code
                    className="font-mono text-[16px] font-semibold tracking-[0.08em] text-[var(--color-text)] break-all"
                    data-testid="two-step-secret"
                  >
                    {groupSecret(setup.secret)}
                  </code>
                  <AppButton variant="neutral" onClick={() => void copy(setup.secret)}>
                    <Copy size={14} aria-hidden /> {t('setup.copy')}
                  </AppButton>
                </div>
                <p className="m-0 mt-2 text-[12px] text-[var(--color-text-muted)]">
                  {t('setup.keyHint')}
                </p>
              </div>
              <a
                href={setup.otpauthUrl}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold"
              >
                <ArrowSquareOut size={14} aria-hidden /> {t('setup.openApp')}
              </a>
              <label className="flex flex-col gap-1 text-[13px] font-medium text-[var(--color-text)]">
                {t('setup.codeLabel')}
                <Input
                  size="large"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, '').slice(0, 7))}
                  onPressEnter={() => code.replace(/\s/g, '').length === 6 && void confirm()}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123 456"
                  data-testid="two-step-code"
                  className="max-w-[200px] font-mono tracking-[0.2em]"
                />
              </label>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4" data-testid="two-step-backup-codes">
          <Alert
            type="success"
            showIcon
            message={t('setup.onTitle')}
            description={t('setup.backupIntro')}
          />
          <ul className="m-0 grid list-none grid-cols-2 gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-4 font-mono text-[15px] font-semibold tracking-[0.08em]">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <AppButton variant="secondary" onClick={downloadCodes} data-testid="two-step-download">
              <DownloadSimple size={14} aria-hidden /> {t('setup.download')}
            </AppButton>
            <AppButton
              variant="neutral"
              onClick={() => {
                void copy(codes.join('\n'))
                setSaved(true)
              }}
            >
              <Copy size={14} aria-hidden /> {t('setup.copyAll')}
            </AppButton>
          </div>
          {!saved && (
            <p className="m-0 text-[12px] text-[var(--color-text-muted)]">{t('setup.saveFirst')}</p>
          )}
        </div>
      )}
    </Modal>
  )
}
