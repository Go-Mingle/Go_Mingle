import { useState, useEffect } from 'react'
import { Modal, Form, Input, Upload, Avatar } from 'antd'
import { Check, UploadSimple as UploadIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { labelClass } from './profileModalHelpers'
import { DESIGNATION_MAX_LENGTH, FULL_NAME_MAX_LENGTH } from '../../modules/account/constants'
import { AppButton } from '../../atoms/AppButton'

export interface EditProfileValues {
  name: string
  designation?: string
}

interface EditProfileModalProps {
  open: boolean
  onClose: () => void
  onSave: (values: EditProfileValues) => void
  initials: string
  userName: string | undefined
  userEmail: string | undefined
  saving?: boolean
}

export function EditProfileModal({
  open,
  onClose,
  onSave,
  initials,
  userName,
  userEmail,
  saving,
}: Readonly<EditProfileModalProps>) {
  const { t } = useTranslation(['profile', 'common'])
  const [editForm] = Form.useForm()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    // Only fields that are actually registered. Seeding a key with no field
    // (email is now render-only) shifts the form registry mid-validate and makes
    // rc-field-form reject with `outOfDate` and zero errorFields.
    if (open) editForm.setFieldsValue({ name: userName })
  }, [open, userName, editForm])

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('editProfile')}
      width={480}
      destroyOnHidden
      footer={null}
    >
      {/* Submission runs through the Form's own onFinish, like ChangeNameModal.
          Calling validateFields() from an onClick races the field registry and
          rejects with `outOfDate` and zero errorFields. */}
      <Form
        form={editForm}
        layout="vertical"
        onFinish={onSave}
        requiredMark={false}
        className="app-form mt-2"
      >
        <div className="flex flex-col items-center mb-5">
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={(file) => {
              setPreviewUrl(URL.createObjectURL(file))
              return false
            }}
          >
            <div className="cursor-pointer relative w-20 h-20">
              <Avatar
                size={80}
                src={previewUrl ?? undefined}
                className="bg-[var(--color-accent)] text-white text-[26px] font-bold"
              >
                {!previewUrl && initials}
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-[rgba(0,0,0,0.35)] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-150">
                <UploadIcon size={18} color="white" />
              </div>
            </div>
          </Upload>
        </div>
        <Form.Item
          label={<span className={labelClass}>{t('fullName')}</span>}
          name="name"
          rules={[
            { required: true, whitespace: true, message: t('fullNameRequired') },
            { max: FULL_NAME_MAX_LENGTH, message: t('fullNameTooLong') },
          ]}
        >
          <Input size="large" />
        </Form.Item>
        {/* Email is the Cognito username and can never be edited (BR-12). */}
        <Form.Item label={<span className={labelClass}>{t('email')}</span>}>
          <Input size="large" type="email" value={userEmail ?? ''} disabled readOnly />
        </Form.Item>
        <Form.Item
          label={<span className={labelClass}>{t('designation')}</span>}
          name="designation"
          rules={[{ max: DESIGNATION_MAX_LENGTH, message: t('designationTooLong') }]}
        >
          <Input size="large" placeholder={t('designationPlaceholder')} />
        </Form.Item>

        <div className="app-modal-footer">
          <AppButton variant="neutral" type="button" onClick={onClose}>
            {t('common:buttons.cancel')}
          </AppButton>
          <AppButton variant="primary" type="submit" disabled={saving}>
            <Check size={14} />
            {t('common:buttons.saveChanges')}
          </AppButton>
        </div>
      </Form>
    </Modal>
  )
}
