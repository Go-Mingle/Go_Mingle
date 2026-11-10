import { Modal, Input } from 'antd'
import { useTranslation } from 'react-i18next'
import { labelClass } from './profileModalHelpers'
import { meetsPasswordPolicy } from '../../../shared/utils/passwordStrength'
import { StrengthBar } from './StrengthBar'
import { AppButton } from '../../atoms/AppButton'

interface ChangePasswordModalProps {
  open: boolean
  onClose: () => void
  changeCurrent: string
  setChangeCurrent: (v: string) => void
  changeNew: string
  setChangeNew: (v: string) => void
  changeConfirm: string
  setChangeConfirm: (v: string) => void
  changeLoading: boolean
  onSubmit: () => Promise<void>
  /** Inline error from Cognito or a client-side rule. */
  error?: string
}

export function ChangePasswordModal({
  open,
  onClose,
  changeCurrent,
  setChangeCurrent,
  changeNew,
  setChangeNew,
  changeConfirm,
  setChangeConfirm,
  changeLoading,
  onSubmit,
  error,
}: Readonly<ChangePasswordModalProps>) {
  const { t } = useTranslation(['profile', 'auth', 'common'])

  /**
   * MET-1290 — reusing the current password is not a change. Surfaced inline and
   * on the gate, like the mismatch rule: when it only fired on submit the button
   * read as valid, so the form looked like it accepted the reuse.
   */
  const reusesCurrent = !!changeNew && changeNew === changeCurrent

  // Gate on the real rule (BR-09), never on a strength score: a score-based
  // gate passes short passwords that mix character classes, which Cognito then
  // rejects with InvalidPasswordException.
  const changeCanSave =
    !!changeCurrent &&
    meetsPasswordPolicy(changeNew) &&
    !!changeConfirm &&
    changeNew === changeConfirm &&
    !reusesCurrent

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('changePasswordTitle')}
      width={480}
      destroyOnHidden
      footer={null}
    >
      <div className="app-form flex flex-col gap-4 mt-2">
        <div>
          <label className={labelClass}>{t('currentPassword')}</label>
          <Input.Password
            size="large"
            value={changeCurrent}
            onChange={(e) => setChangeCurrent(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label className={labelClass}>{t('newPassword')}</label>
          <Input.Password
            size="large"
            value={changeNew}
            onChange={(e) => setChangeNew(e.target.value)}
            autoComplete="off"
            status={reusesCurrent ? 'error' : undefined}
          />
          <StrengthBar password={changeNew} />
          {reusesCurrent && (
            <p className="text-xs text-[var(--color-error)] mt-1">
              {t('auth:errors.samePassword')}
            </p>
          )}
        </div>
        <div>
          <label className={labelClass}>{t('confirmNewPassword')}</label>
          <Input.Password
            size="large"
            value={changeConfirm}
            onChange={(e) => setChangeConfirm(e.target.value)}
            autoComplete="off"
            status={changeConfirm && changeNew !== changeConfirm ? 'error' : undefined}
          />
          {changeConfirm && changeNew !== changeConfirm && (
            <p className="text-xs text-[var(--color-error)] mt-1">{t('passwordMismatch')}</p>
          )}
        </div>

        {error ? <p className="text-xs text-[var(--color-error)] m-0">{error}</p> : null}

        <div className="app-modal-footer">
          <AppButton variant="neutral" onClick={onClose}>
            {t('common:buttons.cancel')}
          </AppButton>
          <AppButton
            variant="primary"
            onClick={() => void onSubmit()}
            disabled={changeLoading || !changeCanSave}
          >
            {changeLoading ? t('common:status.updating') : t('updatePassword')}
          </AppButton>
        </div>
      </div>
    </Modal>
  )
}
