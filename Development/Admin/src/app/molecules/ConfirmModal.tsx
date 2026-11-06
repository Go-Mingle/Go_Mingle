import { Modal } from 'antd'
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
        destroyOnClose
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
            background: danger ? 'var(--color-error-bg)' : 'var(--color-accent-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          {icon ?? (
            <Trash
              size={24}
              weight="fill"
              color={danger ? 'var(--color-error)' : 'var(--color-accent)'}
            />
          )}
        </div>
        <p
          style={{
            margin: '0 0 8px',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--color-text)',
            textAlign: 'center',
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          {title}
        </p>
        <div
          style={{
            margin: '0 0 24px',
            fontSize: 13,
            color: 'var(--color-text-muted)',
            textAlign: 'center',
            fontFamily: 'Poppins, sans-serif',
            lineHeight: 1.6,
          }}
        >
          {content}
        </div>
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
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
