import { Modal } from 'antd'
import { clsx } from 'clsx'
import { Trash } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { PrimaryActionButton, SecondaryActionButton } from '../atoms/ModalActions'
import { MODAL_WIDTH } from '../atoms/modalWidth'

interface ConfirmModalProps {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  title: string
  content: React.ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
  confirmClassName?: string
  singleButton?: boolean
  singleButtonText?: string
  /** Icon shown in the severity circle for the confirm layout (default Trash). */
  icon?: React.ReactNode
}

export function ConfirmModal({
  open,
  onCancel,
  onConfirm,
  title,
  content,
  confirmText,
  cancelText,
  danger = false,
  confirmClassName,
  singleButton = false,
  singleButtonText,
  icon,
}: ConfirmModalProps) {
  const { t } = useTranslation('common')

  // Informational single-button variant — left-aligned title, unchanged.
  if (singleButton) {
    return (
      <Modal
        open={open}
        onCancel={onCancel}
        title={<span className="text-[20px] font-semibold">{title}</span>}
        footer={null}
        width={MODAL_WIDTH.standard}
        destroyOnHidden
      >
        <p className="text-[14px] text-[var(--color-text-muted)] py-2">{content}</p>
        <div className="app-modal-footer">
          <PrimaryActionButton onClick={onCancel}>
            {singleButtonText ?? t('buttons.gotIt')}
          </PrimaryActionButton>
        </div>
      </Modal>
    )
  }

  // Canonical confirmation — centered severity icon-circle + title + description
  // + full-width buttons (matches the portal's other confirm modals).
  return (
    <Modal
      open={open}
      onCancel={onCancel}
      closable={false}
      footer={null}
      width={MODAL_WIDTH.confirm}
      title={null}
      destroyOnHidden
    >
      <div className="flex flex-col items-center pt-2">
        <div
          className={clsx(
            'w-12 h-12 rounded-full flex items-center justify-center mb-4',
            danger ? 'bg-[var(--color-error-bg)]' : 'bg-[var(--color-accent-light)]',
          )}
        >
          {icon ?? (
            <Trash
              size={24}
              weight="fill"
              color={danger ? 'var(--color-error)' : 'var(--color-accent)'}
            />
          )}
        </div>
        <p className="m-0 mb-2 text-[15px] font-semibold text-[var(--color-text)] text-center font-[Poppins,sans-serif]">
          {title}
        </p>
        <div className="m-0 mb-6 text-[13px] text-[var(--color-text-muted)] text-center font-[Poppins,sans-serif] leading-[1.6]">
          {content}
        </div>
        <div className="flex gap-2.5 w-full">
          <SecondaryActionButton fillContainer onClick={onCancel}>
            {cancelText ?? t('buttons.cancel')}
          </SecondaryActionButton>
          <PrimaryActionButton
            danger={danger}
            fillContainer
            className={confirmClassName}
            onClick={onConfirm}
          >
            {confirmText ?? t('buttons.confirm')}
          </PrimaryActionButton>
        </div>
      </div>
    </Modal>
  )
}
