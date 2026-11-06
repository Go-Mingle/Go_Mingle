import { useTranslation } from 'react-i18next'
import { ConfirmModal } from '../../../molecules/ConfirmModal'
import type { UserRow } from './types'

interface DeleteUserModalProps {
  target: UserRow | null
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Delete user (US-06) — a **soft** delete.
 *
 * The Figma's "This action cannot be undone" is wrong, and the spec calls it out:
 * nothing is ever hard-deleted on this platform (BR-10). The record is retained,
 * the user loses access and drops off the list, and re-adding the same email
 * later revives that record (BR-12). The copy now says what actually happens.
 */
export function DeleteUserModal({ target, onConfirm, onCancel }: DeleteUserModalProps) {
  const { t } = useTranslation('users')
  const name = target?.name ?? ''

  return (
    <ConfirmModal
      open={!!target}
      onCancel={onCancel}
      onConfirm={onConfirm}
      danger
      title={t('modals.delete.title')}
      content={
        <>
          {t('modals.delete.confirmPrefix')} <strong>{name}</strong>?{' '}
          {t('modals.delete.softDeleteNote')}
        </>
      }
      cancelText={t('modals.delete.cancel')}
      confirmText={t('modals.delete.confirm')}
    />
  )
}
