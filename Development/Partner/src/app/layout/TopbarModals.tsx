import { useState } from 'react'
import { message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAppSelector, useAppDispatch } from '../../shared/store/hooks'
import { updateUserAction } from '../../shared/store/authSlice'
import { getAuthProvider } from '../../shared/auth/authProvider'
import { AuthError } from '../../shared/auth/authError'
import { getApiErrorMessage } from '../../shared/utils/apiError'
import { meetsPasswordPolicy } from '../../shared/utils/passwordStrength'
import { useUpdatePartnerProfileMutation } from '../modules/account/hooks/usePartnerProfile'
import { initialsOf } from './components/profileModalHelpers'
import { ViewProfileModal } from './components/ViewProfileModal'
import { EditProfileModal, type EditProfileValues } from './components/EditProfileModal'
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
}: Readonly<TopbarModalsProps>) {
  const { t } = useTranslation(['profile', 'auth', 'common'])
  const dispatch = useAppDispatch()
  const [messageApi, contextHolder] = message.useMessage()
  const user = useAppSelector((s) => s.auth.user)
  const initials = user?.initials ?? 'SA'

  const updateProfile = useUpdatePartnerProfileMutation()

  const [changeCurrent, setChangeCurrent] = useState('')
  const [changeNew, setChangeNew] = useState('')
  const [changeConfirm, setChangeConfirm] = useState('')
  const [changeLoading, setChangeLoading] = useState(false)
  const [changeError, setChangeError] = useState('')

  /** Only full name and designation are writable — email is immutable (BR-12). */
  const handleEditSave = (values: EditProfileValues) => {
    updateProfile.mutate(
      { fullName: values.name.trim(), designation: values.designation?.trim() ?? '' },
      {
        onSuccess: (profile) => {
          dispatch(
            updateUserAction({
              name: profile.fullName,
              initials: initialsOf(profile.fullName),
            }),
          )
          void messageApi.success(t('updated'))
          onEditClose()
        },
        onError: (error) => {
          void messageApi.error(getApiErrorMessage(error, t('common:errors.genericError')))
        },
      },
    )
  }

  const resetChangeForm = () => {
    setChangeCurrent('')
    setChangeNew('')
    setChangeConfirm('')
    setChangeError('')
  }

  const handleChangeClose = () => {
    resetChangeForm()
    onChangeClose()
  }

  /** Cognito-direct `ChangePassword`. The current session survives (BR-11). */
  const handleChangePassword = async () => {
    setChangeError('')
    if (!meetsPasswordPolicy(changeNew)) {
      setChangeError(t('auth:newPassword.requirements'))
      return
    }
    if (changeNew !== changeConfirm) {
      setChangeError(t('passwordMismatch'))
      return
    }
    if (changeNew === changeCurrent) {
      setChangeError(t('auth:errors.samePassword'))
      return
    }

    setChangeLoading(true)
    try {
      await getAuthProvider().changePassword(changeCurrent, changeNew)
      void messageApi.success(t('passwordUpdated'))
      resetChangeForm()
      onChangeClose()
    } catch (error) {
      const code = error instanceof AuthError ? error.code : 'UNKNOWN'
      if (code === 'INVALID_CREDENTIALS') {
        setChangeError(t('auth:errors.currentPasswordIncorrect'))
      } else if (code === 'SAME_PASSWORD') {
        setChangeError(t('auth:errors.samePassword'))
      } else if (code === 'INVALID_PASSWORD') {
        setChangeError(t('auth:newPassword.requirements'))
      } else if (code === 'LIMIT_EXCEEDED') {
        setChangeError(t('auth:errors.tooManyAttempts'))
      } else {
        setChangeError(t('common:errors.genericError'))
      }
    } finally {
      setChangeLoading(false)
    }
  }

  return (
    <>
      {contextHolder}
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
        saving={updateProfile.isPending}
      />

      <ChangePasswordModal
        open={changeOpen}
        onClose={handleChangeClose}
        changeCurrent={changeCurrent}
        setChangeCurrent={setChangeCurrent}
        changeNew={changeNew}
        setChangeNew={setChangeNew}
        changeConfirm={changeConfirm}
        setChangeConfirm={setChangeConfirm}
        changeLoading={changeLoading}
        onSubmit={handleChangePassword}
        error={changeError}
      />
    </>
  )
}
