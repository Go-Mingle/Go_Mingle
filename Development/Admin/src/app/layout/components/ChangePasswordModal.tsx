import { useState } from 'react'
import { Modal, Input, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { authService } from '../../modules/auth/services'
import { cognitoSignOut } from '../../modules/auth/cognitoService'
import { logoutAction } from '../../../shared/store/authSlice'
import { useAppDispatch } from '../../../shared/store/hooks'
import { getStrength, labelStyle, coralBtn } from './profileModalHelpers'
import { StrengthBar } from './StrengthBar'
import { SecondaryActionButton } from '../../atoms/ModalActions'

interface ChangePasswordModalProps {
  open: boolean
  onClose: () => void
}

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const { t } = useTranslation(['profile', 'common'])
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [changeCurrent, setChangeCurrent] = useState('')
  const [changeNew, setChangeNew] = useState('')
  const [changeConfirm, setChangeConfirm] = useState('')
  const [changeLoading, setChangeLoading] = useState(false)
  const [error, setError] = useState<string>('')

  // Matches repo B: submit is enabled once the new password reaches at least
  // "Good" strength (>= 3) and the confirmation matches.
  const changeCanSave =
    !!changeCurrent && getStrength(changeNew) >= 3 && !!changeConfirm && changeNew === changeConfirm

  const resetForm = () => {
    setChangeCurrent('')
    setChangeNew('')
    setChangeConfirm('')
    setError('')
  }

  const handleCancel = () => {
    resetForm()
    onClose()
  }

  const onSubmit = async (): Promise<void> => {
    if (!changeCanSave) return

    setChangeLoading(true)
    setError('')
    try {
      await authService.changePassword({
        currentPassword: changeCurrent,
        newPassword: changeNew,
        confirmPassword: changeConfirm,
      })
      resetForm()
      onClose()
      void message.success(t('passwordUpdated'))
      // A successful password change must invalidate the current session:
      // sign out of Cognito (global), clear the local session, and force the
      // user back to /login to re-authenticate with the new password.
      const token = localStorage.getItem('auth-token')
      if (token) await cognitoSignOut(token).catch(() => {})
      dispatch(logoutAction())
      navigate('/login')
    } catch (err: unknown) {
      const apiError = err as { code?: string; message?: string }
      if (apiError.code === 'ERR_CURRENT_PASSWORD_INCORRECT') {
        setError(t('currentPasswordIncorrect', 'Current password is incorrect'))
      } else {
        setError(apiError.message || t('passwordChangeError', 'Failed to change password'))
      }
    } finally {
      setChangeLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={t('changePasswordTitle')}
      width={480}
      destroyOnClose
      footer={null}
    >
      <div className="app-form flex flex-col gap-4 mt-2">
        {error && (
          <div className="text-sm text-[var(--color-error)] bg-[var(--color-error-bg)] p-2 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label style={labelStyle}>{t('currentPassword')}</label>
          <Input.Password
            size="large"
            value={changeCurrent}
            onChange={(e) => setChangeCurrent(e.target.value)}
            autoComplete="off"
            disabled={changeLoading}
          />
        </div>

        <div>
          <label style={labelStyle}>{t('newPassword')}</label>
          <Input.Password
            size="large"
            value={changeNew}
            onChange={(e) => setChangeNew(e.target.value)}
            autoComplete="off"
            disabled={changeLoading}
          />
          <StrengthBar password={changeNew} />
        </div>

        <div>
          <label style={labelStyle}>{t('confirmNewPassword')}</label>
          <Input.Password
            size="large"
            value={changeConfirm}
            onChange={(e) => setChangeConfirm(e.target.value)}
            autoComplete="off"
            disabled={changeLoading}
            status={changeConfirm && changeNew !== changeConfirm ? 'error' : undefined}
          />
          {changeConfirm && changeNew !== changeConfirm && (
            <p className="text-xs text-[var(--color-error)] mt-1">{t('passwordMismatch')}</p>
          )}
        </div>

        <div className="app-modal-footer">
          <SecondaryActionButton onClick={handleCancel} disabled={changeLoading}>
            {t('common:buttons.cancel')}
          </SecondaryActionButton>
          <button
            style={{ ...coralBtn, opacity: !changeCanSave ? 0.5 : 1 }}
            onClick={() => void onSubmit()}
            disabled={changeLoading || !changeCanSave}
          >
            {changeLoading ? t('common:status.updating') : t('updatePassword')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
