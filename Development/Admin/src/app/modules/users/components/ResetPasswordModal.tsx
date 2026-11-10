import { Modal, Button, Form, Input } from 'antd'
import { Key, Check } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { UserRow } from './types'

const validatePassword = (_: unknown, value: string): Promise<void> => {
  if (!value) return Promise.reject(new Error('Password is required'))
  if (value.length < 8) return Promise.reject(new Error('At least 8 characters required'))
  if (!/[A-Z]/.test(value)) return Promise.reject(new Error('Must contain an uppercase letter'))
  if (!/[a-z]/.test(value)) return Promise.reject(new Error('Must contain a lowercase letter'))
  if (!/[0-9]/.test(value)) return Promise.reject(new Error('Must contain a number'))
  if (!/[^A-Za-z0-9]/.test(value))
    return Promise.reject(new Error('Must contain a special character'))
  return Promise.resolve()
}

interface ResetPasswordModalProps {
  target: UserRow | null
  onConfirm: (data: { newPassword: string; confirmNewPassword: string }) => void
  onCancel: () => void
}

interface FormValues {
  newPassword: string
  confirmNewPassword: string
}

export function ResetPasswordModal({ target, onConfirm, onCancel }: ResetPasswordModalProps) {
  const { t } = useTranslation('users')
  const [form] = Form.useForm<FormValues>()
  const name = target?.fullName ?? ''
  const pw = (Form.useWatch('newPassword', form) as string) ?? ''

  const handleCancel = () => {
    form.resetFields()
    onCancel()
  }

  const handleFinish = (values: FormValues) => {
    form.resetFields()
    onConfirm({ newPassword: values.newPassword, confirmNewPassword: values.confirmNewPassword })
  }

  return (
    <Modal
      open={!!target}
      onCancel={handleCancel}
      title={t('modals.resetPassword.title')}
      width={480}
      closable
      footer={null}
      centered
      destroyOnClose
    >
      <p className="text-sm text-(--color-text-muted) mt-1 mb-4">
        Setting a new password for <strong>{name}</strong>.
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
          rules={[{ validator: validatePassword }]}
          className="mb-1"
        >
          <Input.Password placeholder={t('modals.resetPassword.newPlaceholder')} />
        </Form.Item>
        <ul className="list-none m-0 p-0 mb-4 space-y-0.5">
          <li
            className={`text-xs flex items-center gap-1 ${pw.length >= 8 ? 'text-[var(--color-success)]' : 'text-[var(--color-text-subtle)]'}`}
          >
            {pw.length >= 8 && <Check size={12} weight="bold" />}
            At least 8 characters
          </li>
          <li
            className={`text-xs flex items-center gap-1 ${/[A-Z]/.test(pw) ? 'text-[var(--color-success)]' : 'text-[var(--color-text-subtle)]'}`}
          >
            {/[A-Z]/.test(pw) && <Check size={12} weight="bold" />}
            One uppercase letter
          </li>
          <li
            className={`text-xs flex items-center gap-1 ${/[a-z]/.test(pw) ? 'text-[var(--color-success)]' : 'text-[var(--color-text-subtle)]'}`}
          >
            {/[a-z]/.test(pw) && <Check size={12} weight="bold" />}
            One lowercase letter
          </li>
          <li
            className={`text-xs flex items-center gap-1 ${/[0-9]/.test(pw) ? 'text-[var(--color-success)]' : 'text-[var(--color-text-subtle)]'}`}
          >
            {/[0-9]/.test(pw) && <Check size={12} weight="bold" />}
            One number
          </li>
          <li
            className={`text-xs flex items-center gap-1 ${/[^A-Za-z0-9]/.test(pw) ? 'text-[var(--color-success)]' : 'text-[var(--color-text-subtle)]'}`}
          >
            {/[^A-Za-z0-9]/.test(pw) && <Check size={12} weight="bold" />}
            One special character
          </li>
        </ul>

        <Form.Item
          name="confirmNewPassword"
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
          <Button onClick={handleCancel} className="h-9 px-3 rounded-xl">
            {t('modals.resetPassword.cancel')}
          </Button>
          <button
            type="submit"
            className="h-9 px-3 bg-(--color-accent) hover:bg-(--color-accent-dark) text-white border-none rounded-xl text-[13px] font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-[background] duration-150 ease-out"
          >
            <Key size={14} weight="regular" color="white" />
            {t('modals.resetPassword.setPassword')}
          </button>
        </div>
      </Form>
    </Modal>
  )
}
