import { Modal, Input } from 'antd'
import { Prohibit } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { SecondaryActionButton, PrimaryActionButton } from '../../../atoms/ModalActions'

interface SuspendModalProps {
  open: boolean
  minglerName: string
  suspendReason: string
  /** Active bookings that will be cancelled + refunded on suspend; hidden when 0 or unknown. */
  activeBookingsCount?: number
  onSuspendReasonChange: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
  confirmLoading?: boolean
}

export function SuspendModal({
  open,
  minglerName,
  suspendReason,
  activeBookingsCount,
  onSuspendReasonChange,
  onCancel,
  onConfirm,
  confirmLoading = false,
}: SuspendModalProps) {
  const { t } = useTranslation('minglers')
  const isValid = suspendReason.length >= 10

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      closable={false}
      footer={null}
      width={480}
      title={null}
      destroyOnClose
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8 }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--color-error-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <Prohibit size={24} color="var(--color-error)" weight="fill" />
        </div>

        <p
          style={{
            margin: '0 0 20px',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--color-text)',
            textAlign: 'center',
          }}
        >
          {minglerName}
        </p>

        <p
          style={{
            margin: '0 0 20px',
            fontSize: 13,
            color: 'var(--color-text-muted)',
            textAlign: 'center',
          }}
        >
          {t('suspend.consequence')}
        </p>

        {!!activeBookingsCount && (
          <p
            style={{
              margin: '0 0 20px',
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--color-error-bg)',
              color: 'var(--color-error)',
              fontSize: 13,
              fontWeight: 500,
              textAlign: 'left',
            }}
          >
            {t('suspend.activeBookingsWarning', { count: activeBookingsCount })}
          </p>
        )}

        <div style={{ width: '100%', textAlign: 'left' }}>
          <p
            style={{
              margin: '0 0 6px',
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-text-muted)',
            }}
          >
            {t('suspend.reasonLabel')}
          </p>
          <Input.TextArea
            rows={3}
            placeholder={t('suspend.reasonPlaceholder')}
            value={suspendReason}
            onChange={(e) => onSuspendReasonChange(e.target.value)}
            style={{ marginBottom: 4 }}
            maxLength={500}
          />
          {suspendReason.length > 0 && !isValid && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-error)' }}>
              {t('suspend.minChars')}
            </p>
          )}
        </div>

        <div className="app-modal-footer" style={{ alignSelf: 'stretch' }}>
          <SecondaryActionButton onClick={onCancel}>{t('suspend.cancel')}</SecondaryActionButton>
          <PrimaryActionButton
            danger
            disabled={!isValid}
            loading={confirmLoading}
            onClick={onConfirm}
          >
            <Prohibit size={14} /> {t('suspend.confirm')}
          </PrimaryActionButton>
        </div>
      </div>
    </Modal>
  )
}
