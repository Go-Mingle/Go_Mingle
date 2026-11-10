import { Modal, Input } from 'antd'
import { useTranslation } from 'react-i18next'
import { XCircle } from '@phosphor-icons/react'
import { AppButton } from '../../../atoms/AppButton'

interface AppDetailDeclineModalProps {
  open: boolean
  applicationName: string
  declineReason: string
  loading?: boolean
  onReasonChange: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export function AppDetailDeclineModal({
  open,
  applicationName,
  declineReason,
  loading,
  onReasonChange,
  onCancel,
  onConfirm,
}: AppDetailDeclineModalProps) {
  const { t } = useTranslation('approval-queue')
  const declineActive = declineReason.trim().length >= 10

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={t('decline.title')}
      width={480}
      footer={null}
      closable
      destroyOnClose
    >
      <div className="[font-family:var(--font-ui)]">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-[var(--color-error-bg)] flex items-center justify-center">
            <XCircle size={28} color="var(--color-error)" weight="fill" />
          </div>
        </div>
        <p className="m-0 mb-1 text-sm font-semibold text-(--color-text) text-center">
          {applicationName}
        </p>
        <p className="m-0 mb-4 text-[13px] text-(--color-text-muted) text-center leading-[1.6]">
          {t('decline.subtitle')}
        </p>
        <label className="block text-xs font-semibold text-(--color-text-muted) mb-1.5 uppercase tracking-[0.06em]">
          {t('decline.reasonLabel')}
        </label>
        <Input.TextArea
          value={declineReason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder={t('decline.placeholder')}
          className="rounded-lg! [font-family:var(--font-ui)]!"
        />
        <div className="flex justify-between text-[11px] mt-1">
          <span className={declineActive ? 'text-(--color-success)' : 'text-(--color-error)'}>
            {declineActive ? t('detail.readyToSubmit') : t('detail.minChars')}
          </span>
          <span className="text-(--color-text-muted)">{declineReason.length} / 500</span>
        </div>
        <div className="app-modal-footer">
          <AppButton variant="neutral" onClick={onCancel}>
            {t('approve.cancel')}
          </AppButton>
          <AppButton
            variant="danger"
            onClick={onConfirm}
            disabled={!declineActive}
            loading={loading}
          >
            <XCircle size={14} weight="regular" />
            {t('decline.confirmDecline')}
          </AppButton>
        </div>
      </div>
    </Modal>
  )
}
