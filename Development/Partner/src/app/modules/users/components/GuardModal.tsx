import { Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../atoms/AppButton'

interface GuardModalProps {
  message: string | null
  onClose: () => void
}

// Blocked-action notice — e.g. an admin can't modify/remove their own
// account. Shown in a modal (with close icon) instead of a top toast.
export function GuardModal({ message, onClose }: GuardModalProps) {
  const { t } = useTranslation('users')

  return (
    <Modal
      open={!!message}
      onCancel={onClose}
      title={t('guards.title')}
      width={440}
      closable
      footer={null}
      destroyOnHidden
    >
      <p className="text-[14px] text-[var(--color-text-muted)] mt-1 mb-0 mx-0 font-[Poppins,sans-serif] leading-[1.5]">
        {message}
      </p>
      <div className="app-modal-footer">
        <AppButton variant="primary" onClick={onClose}>
          {t('guards.gotIt')}
        </AppButton>
      </div>
    </Modal>
  )
}
