import { Modal } from 'antd'
import { Trash } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { SecondaryActionButton, PrimaryActionButton } from '../../../atoms/ModalActions'

interface DeleteReviewModalProps {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  confirmLoading?: boolean
}

export function DeleteReviewModal({
  open,
  onCancel,
  onConfirm,
  confirmLoading = false,
}: DeleteReviewModalProps) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <Modal
      open={open}
      title={t('restaurants:deleteReview.title')}
      onCancel={onCancel}
      footer={null}
      closable
      destroyOnClose
      width={420}
    >
      <p className="text-sm text-[var(--color-text-muted)] m-0 mt-1">
        {t('restaurants:deleteReview.content')}
      </p>
      <div className="app-modal-footer">
        <SecondaryActionButton onClick={onCancel}>
          {t('common:buttons.cancel')}
        </SecondaryActionButton>
        <PrimaryActionButton
          danger
          disabled={confirmLoading}
          aria-busy={confirmLoading}
          onClick={onConfirm}
        >
          <Trash size={14} weight="regular" />
          {t('restaurants:deleteReview.confirm')}
        </PrimaryActionButton>
      </div>
    </Modal>
  )
}
