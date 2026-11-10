import { Check } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../atoms/AppButton'

interface SaveButtonProps {
  isValid: boolean
  isEdit: boolean
  onClick: () => void
  /** In flight — keeps a double submit from creating two users. */
  isSaving?: boolean
}

export function SaveButton({ isValid, isEdit, onClick, isSaving = false }: SaveButtonProps) {
  const { t } = useTranslation(['users', 'common'])

  return (
    <AppButton variant="primary" type="button" onClick={onClick} disabled={!isValid || isSaving}>
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
  isSaving?: boolean
}

export function ModalFooter({
  isValid,
  isEdit,
  onSave,
  onCancel,
  isSaving = false,
}: ModalFooterProps) {
  const { t } = useTranslation('users')

  return (
    <div className="app-modal-footer">
      <AppButton variant="neutral" onClick={onCancel}>
        {t('modals.footer.cancel')}
      </AppButton>
      <SaveButton isValid={isValid} isEdit={isEdit} isSaving={isSaving} onClick={onSave} />
    </div>
  )
}
