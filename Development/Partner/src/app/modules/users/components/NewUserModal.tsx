import { Modal, Form, Input, Select } from 'antd'
import type { FormInstance } from 'antd'
import { useTranslation } from 'react-i18next'
import { meetsPasswordPolicy } from '../../../../shared/utils/passwordStrength'
import { DESIGNATION_MAX_LENGTH, FULL_NAME_MAX_LENGTH } from '../constants'
import { ModalFooter } from './FormButtons'

const labelClassName =
  'text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]'

interface NewUserModalProps {
  open: boolean
  form: FormInstance
  isValid: boolean
  isSaving?: boolean
  onSave: () => void
  onCancel: () => void
}

/**
 * New user (US-02). The creator sets the password inline and the backend emails
 * the new user their login email and that password (BR-05) — there is no forced
 * reset, so they can sign in immediately.
 *
 * No Role field: partner users have no roles (BR-01).
 */
export function NewUserModal({
  open,
  form,
  isValid,
  isSaving = false,
  onSave,
  onCancel,
}: NewUserModalProps) {
  const { t } = useTranslation('users')

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      title={t('modals.new.title')}
      width={520}
      destroyOnHidden
      className="user-modal"
    >
      <Form form={form} layout="vertical" className="app-form mt-1" requiredMark={false}>
        <Form.Item
          name="name"
          label={<span className={labelClassName}>{t('modals.new.fullName')}</span>}
          rules={[
            { required: true, whitespace: true, message: t('validation.required') },
            { max: FULL_NAME_MAX_LENGTH, message: t('validation.nameTooLong') },
          ]}
          className="mb-4"
          colon={false}
        >
          <Input size="large" />
        </Form.Item>

        <Form.Item
          name="email"
          label={<span className={labelClassName}>{t('modals.new.email')}</span>}
          rules={[{ required: true, type: 'email', message: t('validation.emailInvalid') }]}
          className="mb-4"
          colon={false}
        >
          <Input size="large" />
        </Form.Item>

        <Form.Item
          name="designation"
          label={<span className={labelClassName}>{t('modals.new.designation')}</span>}
          rules={[{ max: DESIGNATION_MAX_LENGTH, message: t('validation.designationTooLong') }]}
          className="mb-4"
          colon={false}
        >
          <Input size="large" placeholder={t('modals.new.designationPlaceholder')} />
        </Form.Item>

        <Form.Item
          name="status"
          label={<span className={labelClassName}>{t('modals.new.status')}</span>}
          rules={[{ required: true, message: t('validation.required') }]}
          initialValue="active"
          className="mb-4"
          colon={false}
        >
          <Select
            size="large"
            placeholder={t('modals.new.selectStatus')}
            options={[
              { value: 'active', label: t('statusOptions.active') },
              { value: 'suspended', label: t('statusOptions.suspended') },
            ]}
          />
        </Form.Item>

        <div className="flex flex-col md:flex-row gap-4">
          <Form.Item
            name="password"
            label={<span className={labelClassName}>{t('modals.new.password')}</span>}
            rules={[
              { required: true, message: t('validation.required') },
              {
                // BR-08 — the pool's own rule. Checked here so the specific
                // wording appears inline instead of arriving as a 422 toast.
                validator: (_, value: string) =>
                  !value || meetsPasswordPolicy(value)
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('validation.passwordPolicy'))),
              },
            ]}
            className="flex-1 mb-0"
            colon={false}
          >
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label={<span className={labelClassName}>{t('modals.new.confirmPassword')}</span>}
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
        isSaving={isSaving}
        onSave={onSave}
        onCancel={onCancel}
      />
    </Modal>
  )
}
