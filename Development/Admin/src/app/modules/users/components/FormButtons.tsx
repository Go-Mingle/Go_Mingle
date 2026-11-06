import { Check } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../atoms/AppButton'

interface SaveButtonProps {
  isValid: boolean
  isEdit: boolean
  onClick: () => void
  submitting?: boolean
}

export function SaveButton({ isValid, isEdit, onClick, submitting = false }: SaveButtonProps) {
  const { t } = useTranslation('users')

  return (
    <AppButton
      variant="primary"
      type="button"
      onClick={onClick}
      disabled={!isValid}
      loading={submitting}
    >
      <Check size={14} weight="bold" />
      {isEdit ? t('modals.footer.saveChanges') : t('modals.footer.sendInvite')}
    </AppButton>
  )
}

interface ModalFooterProps {
  isValid: boolean
  isEdit: boolean
  onSave: () => void
  onCancel: () => void
  submitting?: boolean
}

export function ModalFooter({
  isValid,
  isEdit,
  onSave,
  onCancel,
  submitting = false,
}: ModalFooterProps) {
  const { t } = useTranslation('users')

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
        paddingTop: 20,
        paddingBottom: 24,
        paddingLeft: 28,
        paddingRight: 28,
        borderTop: '1px solid var(--color-border)',
        marginTop: 24,
        marginLeft: -28,
        marginRight: -28,
      }}
    >
      <AppButton variant="neutral" onClick={onCancel}>
        {t('modals.footer.cancel')}
      </AppButton>
      <SaveButton isValid={isValid} isEdit={isEdit} onClick={onSave} submitting={submitting} />
    </div>
  )
}
