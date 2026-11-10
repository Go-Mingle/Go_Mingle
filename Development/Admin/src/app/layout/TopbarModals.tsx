import { message } from 'antd'
import type { FormInstance } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAppSelector, useAppDispatch } from '../../shared/store/hooks'
import { updateUserAction } from '../../shared/store/authSlice'
import { ViewProfileModal } from './components/ViewProfileModal'
import { EditProfileModal } from './components/EditProfileModal'
import { ChangePasswordModal } from './components/ChangePasswordModal'

interface TopbarModalsProps {
  viewOpen: boolean
  onViewClose: () => void
  editOpen: boolean
  onEditClose: () => void
  changeOpen: boolean
  onChangeClose: () => void
}

export function TopbarModals({
  viewOpen,
  onViewClose,
  editOpen,
  onEditClose,
  changeOpen,
  onChangeClose,
}: TopbarModalsProps) {
  const { t } = useTranslation('profile')
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)
  const initials = user?.initials ?? 'SA'

  const handleEditSave = async (form: FormInstance) => {
    try {
      const vals = (await form.validateFields()) as { name: string; email: string }
      const newInitials = vals.name
        .split(' ')
        .map((w: string) => w[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase()
      dispatch(updateUserAction({ name: vals.name, email: vals.email, initials: newInitials }))
      message.success(t('updated'))
      onEditClose()
    } catch {
      /* validation failed */
    }
  }

  return (
    <>
      <ViewProfileModal
        open={viewOpen}
        onClose={onViewClose}
        initials={initials}
        userName={user?.name}
        userRole={user?.role}
        userEmail={user?.email}
      />

      <EditProfileModal
        open={editOpen}
        onClose={onEditClose}
        onSave={handleEditSave}
        initials={initials}
        userName={user?.name}
        userEmail={user?.email}
      />

      <ChangePasswordModal open={changeOpen} onClose={onChangeClose} />
    </>
  )
}
