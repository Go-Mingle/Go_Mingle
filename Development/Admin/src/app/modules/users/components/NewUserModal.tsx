import { Modal, Form, Input, Select } from 'antd'
import type { FormInstance } from 'antd'
import { Check } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { LABEL_STYLE } from './tableHelpers'
import { ModalFooter } from './FormButtons'
import { emailValidatorRule } from '../../../../shared/utils/email'

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

interface NewUserModalProps {
  open: boolean
  form: FormInstance
  roleOptions: { value: string; label: string }[]
  onSave: () => void
  onCancel: () => void
  submitting?: boolean
}

export function NewUserModal({
  open,
  form,
  roleOptions,
  onSave,
  onCancel,
  submitting = false,
}: NewUserModalProps) {
  const { t } = useTranslation('users')
  const newName = (Form.useWatch('name', form) as string) ?? ''
  const newEmail = (Form.useWatch('email', form) as string) ?? ''
  const newRole = Form.useWatch('role', form)
  const newStatus = Form.useWatch('status', form)
  const newPassword = (Form.useWatch('password', form) as string) ?? ''
  const newConfirmPwd = (Form.useWatch('confirmPassword', form) as string) ?? ''
  const isValid = !!(
    newName.trim() &&
    newEmail.trim() &&
    newRole &&
    newStatus !== undefined &&
    newPassword.trim() &&
    newPassword === newConfirmPwd
  )

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      title={t('modals.new.title')}
      width={520}
      destroyOnClose
      className="user-modal"
    >
      <Form form={form} layout="vertical" className="app-form mt-1" requiredMark={false}>
        <Form.Item
          name="name"
          label={<span style={LABEL_STYLE}>{t('modals.new.fullName')}</span>}
          rules={[
            { required: true, message: t('validation.required') },
            { max: 255, message: t('validation.invalidName') },
          ]}
          className="mb-4"
          colon={false}
        >
          <Input size="large" />
        </Form.Item>

        <Form.Item
          name="email"
          label={<span style={LABEL_STYLE}>{t('modals.new.email')}</span>}
          rules={[
            { required: true, message: t('validation.required') },
            { max: 320, message: t('validation.invalidEmail') },
            emailValidatorRule(t('validation.invalidEmail')),
          ]}
          className="mb-4"
          colon={false}
        >
          <Input size="large" />
        </Form.Item>

        <div className="flex gap-4">
          <Form.Item
            name="role"
            label={<span style={LABEL_STYLE}>{t('modals.new.role')}</span>}
            rules={[{ required: true, message: t('validation.required') }]}
            className="flex-1 mb-4"
            colon={false}
          >
            <Select size="large" options={roleOptions} placeholder={t('modals.new.selectRole')} />
          </Form.Item>
          <Form.Item
            name="status"
            label={<span style={LABEL_STYLE}>{t('modals.new.status')}</span>}
            rules={[{ required: true, message: t('validation.required') }]}
            initialValue="ACTIVE"
            className="flex-1 mb-4"
            colon={false}
          >
            <Select
              size="large"
              placeholder={t('modals.new.selectStatus')}
              options={[
                { value: 'ACTIVE', label: t('statusOptions.active') },
                { value: 'SUSPENDED', label: t('statusOptions.suspended') },
              ]}
            />
          </Form.Item>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <Form.Item
              name="password"
              label={<span style={LABEL_STYLE}>{t('modals.new.password')}</span>}
              rules={[{ validator: validatePassword }]}
              className="mb-1"
              colon={false}
            >
              <Input.Password size="large" />
            </Form.Item>
            <ul className="list-none m-0 p-0 mb-2 space-y-0.5">
              <li
                className={`text-xs flex items-center gap-1 ${newPassword.length >= 8 ? 'text-green-500' : 'text-gray-400'}`}
              >
                {newPassword.length >= 8 && <Check size={12} weight="bold" />}
                At least 8 characters
              </li>
              <li
                className={`text-xs flex items-center gap-1 ${/[A-Z]/.test(newPassword) ? 'text-green-500' : 'text-gray-400'}`}
              >
                {/[A-Z]/.test(newPassword) && <Check size={12} weight="bold" />}
                One uppercase letter
              </li>
              <li
                className={`text-xs flex items-center gap-1 ${/[a-z]/.test(newPassword) ? 'text-green-500' : 'text-gray-400'}`}
              >
                {/[a-z]/.test(newPassword) && <Check size={12} weight="bold" />}
                One lowercase letter
              </li>
              <li
                className={`text-xs flex items-center gap-1 ${/[0-9]/.test(newPassword) ? 'text-green-500' : 'text-gray-400'}`}
              >
                {/[0-9]/.test(newPassword) && <Check size={12} weight="bold" />}
                One number
              </li>
              <li
                className={`text-xs flex items-center gap-1 ${/[^A-Za-z0-9]/.test(newPassword) ? 'text-green-500' : 'text-gray-400'}`}
              >
                {/[^A-Za-z0-9]/.test(newPassword) && <Check size={12} weight="bold" />}
                One special character
              </li>
            </ul>
          </div>
          <Form.Item
            name="confirmPassword"
            label={<span style={LABEL_STYLE}>{t('modals.new.confirmPassword')}</span>}
            rules={[
              { required: true, message: t('validation.required') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve()
                  return Promise.reject(new Error(t('validation.passwordsDoNotMatch')))
                },
              }),
            ]}
            className="flex-1 mb-0"
            colon={false}
          >
            <Input.Password size="large" />
          </Form.Item>
        </div>
      </Form>

      <ModalFooter
        isValid={isValid}
        isEdit={false}
        onSave={onSave}
        onCancel={onCancel}
        submitting={submitting}
      />
    </Modal>
  )
}
