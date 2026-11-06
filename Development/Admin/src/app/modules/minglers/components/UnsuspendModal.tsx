import { Modal } from 'antd'
import { LockOpen } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { SecondaryActionButton, PrimaryActionButton } from '../../../atoms/ModalActions'

interface UnsuspendModalProps {
  open: boolean
  minglerName: string
  onCancel: () => void
  onConfirm: () => void
  confirmLoading?: boolean
}

export function UnsuspendModal({
  open,
  minglerName,
  onCancel,
  onConfirm,
  confirmLoading = false,
}: UnsuspendModalProps) {
  const { t } = useTranslation('minglers')

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
            background: 'var(--color-success-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <LockOpen size={24} color="var(--color-success)" weight="fill" />
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
            margin: '0 0 8px',
            fontSize: 14,
            color: 'var(--color-text-muted)',
            textAlign: 'center',
          }}
        >
          {t('unsuspend.content')}
        </p>

        <div className="app-modal-footer" style={{ alignSelf: 'stretch' }}>
          <SecondaryActionButton onClick={onCancel}>{t('unsuspend.cancel')}</SecondaryActionButton>
          <PrimaryActionButton onClick={onConfirm} loading={confirmLoading}>
            <LockOpen size={14} /> {t('unsuspend.confirm')}
          </PrimaryActionButton>
        </div>
      </div>
    </Modal>
  )
}
