import { Modal } from 'antd'
import { UserCircleCheck } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { SecondaryActionButton, PrimaryActionButton } from '../../../atoms/ModalActions'

interface RestaurantUnsuspendModalProps {
  open: boolean
  restaurantName: string | undefined
  onCancel: () => void
  onConfirm: () => void
  confirmLoading?: boolean
}

export function RestaurantUnsuspendModal({
  open,
  restaurantName,
  onCancel,
  onConfirm,
  confirmLoading = false,
}: RestaurantUnsuspendModalProps) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <Modal
      open={open}
      title={t('restaurants:unsuspend.title', { name: restaurantName ?? '' })}
      onCancel={onCancel}
      footer={null}
      closable
      destroyOnClose
      width={480}
    >
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
        {t('restaurants:unsuspend.content', { name: restaurantName })}
      </p>
      <div className="app-modal-footer">
        <SecondaryActionButton onClick={onCancel}>
          {t('common:buttons.cancel')}
        </SecondaryActionButton>
        <PrimaryActionButton onClick={onConfirm} loading={confirmLoading}>
          <UserCircleCheck size={14} weight="regular" />
          {t('restaurants:unsuspend.confirm')}
        </PrimaryActionButton>
      </div>
    </Modal>
  )
}
