import { useTranslation } from 'react-i18next'
import { ConfirmModal } from '../../../molecules/ConfirmModal'
import type { UserRow } from './types'

interface DeleteUserModalProps {
  target: UserRow | null
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteUserModal({ target, onConfirm, onCancel }: DeleteUserModalProps) {
  const { t } = useTranslation('users')
  const name = target?.fullName ?? ''

  return (
    <ConfirmModal
      open={!!target}
      onCancel={onCancel}
      onConfirm={onConfirm}
      danger
      title={t('modals.delete.title')}
      content={
        <>
          Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.
        </>
      }
      cancelText={t('modals.delete.cancel')}
      confirmText={t('modals.delete.confirm')}
    />
  )
}
