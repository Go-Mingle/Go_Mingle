import { useEffect } from 'react'
import { Alert, Form, Input, Modal, Spin, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAppDispatch } from '../../../shared/store/hooks'
import { updateUserAction } from '../../../shared/store/authSlice'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import { DESIGNATION_MAX_LENGTH, FULL_NAME_MAX_LENGTH } from '../../modules/account/constants'
import {
  usePartnerProfile,
  useUpdatePartnerProfileMutation,
} from '../../modules/account/hooks/usePartnerProfile'
import { AppButton } from '../../atoms/AppButton'
import { initialsOf, labelClass } from './profileModalHelpers'

interface ChangeNameModalProps {
  open: boolean
  onClose: () => void
}

interface ProfileFormValues {
  fullName: string
  designation?: string
}

/**
 * My Profile (J2 US-05) — reached from the topbar account menu.
 *
 * Email is rendered read-only because it is the Cognito username and immutable
 * (BR-12); only full name and designation are writable (BR-13). The save sends
 * exactly those two keys — the backend rejects anything else outright rather
 * than ignoring it.
 */
export function ChangeNameModal({ open, onClose }: Readonly<ChangeNameModalProps>) {
  const { t } = useTranslation(['profile', 'common'])
  const dispatch = useAppDispatch()
  const [messageApi, contextHolder] = message.useMessage()
  const [form] = Form.useForm<ProfileFormValues>()

  const { data: profile, isPending, isError, error } = usePartnerProfile(open)
  const updateProfile = useUpdatePartnerProfileMutation()

  useEffect(() => {
    if (open && profile) {
      form.setFieldsValue({
        fullName: profile.fullName,
        designation: profile.designation ?? '',
      })
    }
  }, [open, profile, form])

  const handleFinish = (values: ProfileFormValues) => {
    updateProfile.mutate(
      {
        fullName: values.fullName.trim(),
        // Sending '' is how a partner clears their designation; omitting it
        // would instead keep the stored value.
        designation: values.designation?.trim() ?? '',
      },
      {
        onSuccess: (updated) => {
          dispatch(
            updateUserAction({
              name: updated.fullName,
              email: updated.email,
              initials: initialsOf(updated.fullName),
            }),
          )
          void messageApi.success(t('updated'))
          onClose()
        },
        onError: (mutationError) => {
          // 422 carries the specific rule ("Full name is required." /
          // "Designation must be 100 characters or fewer.") — show it verbatim.
          void messageApi.error(getApiErrorMessage(mutationError, t('common:errors.genericError')))
        },
      },
    )
  }

  const handleCancel = () => {
    onClose()
    form.resetFields()
  }

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={<span className="text-[20px] font-semibold">{t('myProfile')}</span>}
      footer={null}
      width={420}
      destroyOnHidden
    >
      {contextHolder}

      {isPending && (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      )}

      {isError && (
        <Alert
          type="error"
          className="my-2"
          message={getApiErrorMessage(error, t('common:errors.fetchError'))}
        />
      )}

      {!isPending && !isError && profile && (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          requiredMark={false}
          className="app-form mt-4"
        >
          <Form.Item label={<span className={labelClass}>{t('email')}</span>}>
            <Input size="large" value={profile.email} disabled readOnly />
          </Form.Item>

          <Form.Item
            label={<span className={labelClass}>{t('fullName')}</span>}
            name="fullName"
            rules={[
              { required: true, whitespace: true, message: t('fullNameRequired') },
              { max: FULL_NAME_MAX_LENGTH, message: t('fullNameTooLong') },
            ]}
          >
            <Input size="large" placeholder={t('enterFullName')} />
          </Form.Item>

          <Form.Item
            label={<span className={labelClass}>{t('designation')}</span>}
            name="designation"
            rules={[{ max: DESIGNATION_MAX_LENGTH, message: t('designationTooLong') }]}
          >
            <Input size="large" placeholder={t('designationPlaceholder')} />
          </Form.Item>

          <div className="app-modal-footer">
            <AppButton variant="neutral" type="button" onClick={handleCancel}>
              {t('cancel')}
            </AppButton>
            <AppButton variant="primary" type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? t('common:status.updating') : t('saveChanges')}
            </AppButton>
          </div>
        </Form>
      )}
    </Modal>
  )
}
