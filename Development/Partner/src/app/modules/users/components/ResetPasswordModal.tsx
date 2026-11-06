import { Modal, Form, Input } from 'antd'
import { Key } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { meetsPasswordPolicy } from '../../../../shared/utils/passwordStrength'
import type { UserRow } from './types'
import { AppButton } from '../../../atoms/AppButton'

interface FormValues {
  newPassword: string
  confirmPassword: string
}

interface ResetPasswordModalProps {
  target: UserRow | null
  isSaving?: boolean
  onConfirm: (values: FormValues) => void
  onCancel: () => void
}

/**
 * Set new password (US-04).
 *
 * Silent by contract — the backend sends no email (BR-07), unlike create, which
 * does email the password. The success copy at the call site has to say so, or
 * the actor assumes the user was notified and nobody tells them.
 *
 * Allowed on the primary user, unlike suspend and delete (AC-01.3).
 */
export function ResetPasswordModal({
  target,
  isSaving = false,
  onConfirm,
  onCancel,
}: ResetPasswordModalProps) {
  const { t } = useTranslation('users')
  const [form] = Form.useForm<FormValues>()
  const name = target?.name ?? ''

  const handleCancel = () => {
    form.resetFields()
    onCancel()
  }

  const handleFinish = (values: FormValues) => {
    onConfirm(values)
    form.resetFields()
  }

  return (
    <Modal
      open={!!target}
      onCancel={handleCancel}
      title={t('modals.resetPassword.title')}
      width={480}
      closable
      footer={null}
      destroyOnHidden
    >
      <p className="mx-0 mt-1 mb-4 font-[Poppins,sans-serif] text-sm text-[var(--color-text-muted)]">
        {t('modals.resetPassword.content')} <strong>{name}</strong>.
      </p>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        requiredMark={false}
        className="app-form"
      >
        <Form.Item
          name="newPassword"
          label={t('modals.resetPassword.newPassword')}
          rules={[
            { required: true, message: t('modals.resetPassword.passwordRequired') },
            {
              // BR-08 — the same rule as create and as the Cognito pool policy.
              validator: (_, value: string) =>
                !value || meetsPasswordPolicy(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('validation.passwordPolicy'))),
            },
          ]}
        >
          <Input.Password placeholder={t('modals.resetPassword.newPlaceholder')} />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label={t('modals.resetPassword.confirmPassword')}
          dependencies={['newPassword']}
          rules={[
            { required: true, message: t('modals.resetPassword.confirmRequired') },
            ({ getFieldValue }) => ({
              validator(_, value: string) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error(t('modals.resetPassword.passwordsDoNotMatch')))
              },
            }),
          ]}
        >
          <Input.Password placeholder={t('modals.resetPassword.confirmPlaceholder')} />
        </Form.Item>

        <div className="app-modal-footer">
          <AppButton variant="neutral" onClick={handleCancel}>
            {t('modals.resetPassword.cancel')}
          </AppButton>
          <AppButton variant="primary" type="submit" disabled={isSaving}>
            <Key size={14} weight="regular" />
            {t('modals.resetPassword.setPassword')}
          </AppButton>
        </div>
      </Form>
    </Modal>
  )
}
