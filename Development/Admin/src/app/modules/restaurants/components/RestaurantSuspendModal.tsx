import { Modal, Input } from 'antd'
import { UserCircleMinus } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { SecondaryActionButton, PrimaryActionButton } from '../../../atoms/ModalActions'

interface RestaurantSuspendModalProps {
  open: boolean
  restaurantName: string | undefined
  reason: string
  onReasonChange: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
  confirmLoading?: boolean
  /** Optional warning line, e.g. active-bookings count that will be cancelled. */
  activeBookingsWarning?: string
}

export function RestaurantSuspendModal({
  open,
  restaurantName,
  reason,
  onReasonChange,
  onCancel,
  onConfirm,
  confirmLoading = false,
  activeBookingsWarning,
}: RestaurantSuspendModalProps) {
  const { t } = useTranslation(['restaurants', 'common'])
  const minMet = reason.length >= 10

  return (
    <Modal
      open={open}
      title={t('restaurants:suspend.title', { name: restaurantName ?? '' })}
      onCancel={onCancel}
      footer={null}
      closable
      destroyOnClose
      width={480}
    >
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
        {t('restaurants:suspend.consequence')}
      </p>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
        {t('restaurants:suspend.reason')}
      </p>
      {activeBookingsWarning ? (
        <p style={{ fontSize: 13, color: 'var(--color-error)', marginBottom: 12 }}>
          {activeBookingsWarning}
        </p>
      ) : null}
      <Input.TextArea
        value={reason}
        onChange={(e) => onReasonChange(e.target.value)}
        placeholder={t('restaurants:suspend.placeholder')}
        rows={3}
        style={{ borderRadius: 8, fontFamily: 'Poppins, sans-serif' }}
      />
      <div
        style={{
          fontSize: 11,
          color: minMet ? 'var(--color-text-muted)' : 'var(--color-error)',
          fontFamily: 'Poppins, sans-serif',
          textAlign: 'right',
          marginTop: 4,
        }}
      >
        {reason.length}/10 characters minimum
      </div>
      <div className="app-modal-footer">
        <SecondaryActionButton onClick={onCancel}>
          {t('common:buttons.cancel')}
        </SecondaryActionButton>
        <PrimaryActionButton danger disabled={!minMet} loading={confirmLoading} onClick={onConfirm}>
          <UserCircleMinus size={14} weight="regular" />
          {t('restaurants:suspend.confirm')}
        </PrimaryActionButton>
      </div>
    </Modal>
  )
}
