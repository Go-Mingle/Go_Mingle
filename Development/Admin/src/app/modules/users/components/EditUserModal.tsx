import { Modal, Form, Input, Select } from 'antd'
import type { FormInstance } from 'antd'
import { Lock } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { LABEL_STYLE } from './tableHelpers'
import { ModalFooter } from './FormButtons'

interface EditUserModalProps {
  open: boolean
  form: FormInstance
  roleOptions: { value: string; label: string }[]
  onSave: () => void
  onCancel: () => void
}

export function EditUserModal({ open, form, roleOptions, onSave, onCancel }: EditUserModalProps) {
  const { t } = useTranslation('users')
  const editName = (Form.useWatch('name', form) as string) ?? ''
  const editRole = Form.useWatch('role', form) as string | undefined
  const editStatus = Form.useWatch('status', form)

  // A-02 (pentest) — when the assigned role has been deleted it is absent from
  // GET /roles/active, so the Select had no matching option and displayed the raw
  // UUID, while `isValid` still accepted it: saving re-submitted the dead roleId
  // and the administrator stayed locked out. Surface it as an explicit option and
  // require the operator to pick a live role before Save enables.
  const isRoleDeleted = !!editRole && !roleOptions.some((r) => r.value === editRole)
  const selectOptions = isRoleDeleted
    ? [
        { value: editRole, label: t('modals.edit.roleDeletedOption'), disabled: true },
        ...roleOptions,
      ]
    : roleOptions

  const isValid = !!(editName.trim() && editRole && editStatus) && !isRoleDeleted

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      title={t('modals.edit.title')}
      width={520}
      destroyOnClose
      className="user-modal"
    >
      <Form
        form={form}
        layout="vertical"
        className="app-form"
        requiredMark={false}
        style={{ marginTop: 4 }}
      >
        <Form.Item
          name="name"
          label={<span style={LABEL_STYLE}>{t('modals.edit.fullName')}</span>}
          rules={[{ required: true, message: t('validation.required') }]}
          style={{ marginBottom: 16 }}
          colon={false}
        >
          <Input size="large" />
        </Form.Item>

        <Form.Item
          name="email"
          label={<span style={LABEL_STYLE}>{t('modals.edit.email')}</span>}
          style={{ marginBottom: 16 }}
          colon={false}
          help={
            <span style={{ fontSize: 11, color: 'var(--color-text-subtle)' }}>
              {t('modals.edit.emailHint')}
            </span>
          }
        >
          <Input
            size="large"
            disabled
            suffix={<Lock size={14} style={{ color: 'var(--color-text-subtle)' }} />}
            style={{ background: 'var(--color-page)', cursor: 'not-allowed' }}
          />
        </Form.Item>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item
            name="role"
            label={<span style={LABEL_STYLE}>{t('modals.edit.role')}</span>}
            rules={[{ required: true, message: t('validation.required') }]}
            style={{ flex: 1, marginBottom: 0 }}
            colon={false}
            validateStatus={isRoleDeleted ? 'error' : undefined}
            help={isRoleDeleted ? t('modals.edit.roleDeletedReassign') : undefined}
          >
            <Select
              size="large"
              options={selectOptions}
              placeholder={t('modals.edit.selectRole')}
            />
          </Form.Item>
          <Form.Item
            name="status"
            label={<span style={LABEL_STYLE}>{t('modals.edit.status')}</span>}
            rules={[{ required: true, message: t('validation.required') }]}
            style={{ flex: 1, marginBottom: 0 }}
            colon={false}
          >
            <Select
              size="large"
              placeholder={t('modals.edit.selectStatus')}
              options={[
                { value: 'ACTIVE', label: t('statusOptions.active') },
                { value: 'SUSPENDED', label: t('statusOptions.suspended') },
              ]}
            />
          </Form.Item>
        </div>
      </Form>

      <ModalFooter isValid={isValid} isEdit={true} onSave={onSave} onCancel={onCancel} />
    </Modal>
  )
}
