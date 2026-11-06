import { Modal, Form, Input, Select, Tooltip } from 'antd'
import type { FormInstance } from 'antd'
import { Lock } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { DESIGNATION_MAX_LENGTH, FULL_NAME_MAX_LENGTH } from '../constants'
import { ModalFooter } from './FormButtons'

const LABEL_CLASS =
  'text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]'

interface EditUserModalProps {
  open: boolean
  form: FormInstance
  /** Read-only. Grid rows do not carry an email, so it can legitimately be absent. */
  email?: string
  /** True for the primary user — status is fixed, everything else stays editable (BR-03). */
  statusDisabled?: boolean
  isValid: boolean
  isSaving?: boolean
  onSave: () => void
  onCancel: () => void
}

/**
 * Edit user (US-03) — full name, designation and status.
 *
 * There is deliberately no Role control. Partner users have no roles or
 * permission tiers (BR-01 / F1 BR-08); the dropdown in the Figma is a design
 * error the spec explicitly excludes from the build (AC-03.3).
 *
 * Status doubles as suspend/activate (US-05) — there is no separate control.
 */
export function EditUserModal({
  open,
  form,
  email,
  statusDisabled = false,
  isValid,
  isSaving = false,
  onSave,
  onCancel,
}: EditUserModalProps) {
  const { t } = useTranslation('users')

  const statusField = (
    <Form.Item
      name="status"
      label={<span className={LABEL_CLASS}>{t('modals.edit.status')}</span>}
      rules={[{ required: true, message: t('validation.required') }]}
      className="mb-0 flex-1"
      colon={false}
    >
      <Select
        size="large"
        disabled={statusDisabled}
        placeholder={t('modals.edit.selectStatus')}
        options={[
          { value: 'active', label: t('statusOptions.active') },
          { value: 'suspended', label: t('statusOptions.suspended') },
        ]}
      />
    </Form.Item>
  )

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      title={t('modals.edit.title')}
      width={520}
      destroyOnHidden
      className="user-modal"
    >
      <Form form={form} layout="vertical" className="app-form mt-1" requiredMark={false}>
        <Form.Item
          name="name"
          label={<span className={LABEL_CLASS}>{t('modals.edit.fullName')}</span>}
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
          label={<span className={LABEL_CLASS}>{t('modals.edit.email')}</span>}
          className="mb-4"
          colon={false}
          help={
            <span className="text-[11px] text-[var(--color-text-subtle)]">
              {t('modals.edit.emailHint')}
            </span>
          }
        >
          <Input
            size="large"
            disabled
            readOnly
            value={email ?? ''}
            suffix={<Lock size={14} className="text-[var(--color-text-subtle)]" />}
            className="cursor-not-allowed bg-[var(--color-page)]"
          />
        </Form.Item>

        <Form.Item
          name="designation"
          label={<span className={LABEL_CLASS}>{t('modals.edit.designation')}</span>}
          rules={[{ max: DESIGNATION_MAX_LENGTH, message: t('validation.designationTooLong') }]}
          className="mb-4"
          colon={false}
        >
          <Input size="large" placeholder={t('modals.edit.designationPlaceholder')} />
        </Form.Item>

        <div className="flex flex-col gap-4 md:flex-row">
          {statusDisabled ? (
            <Tooltip title={t('guards.primaryStatusLocked')} className="flex-1">
              <div className="flex-1">{statusField}</div>
            </Tooltip>
          ) : (
            statusField
          )}
        </div>
      </Form>

      <ModalFooter
        isValid={isValid}
        isEdit={true}
        isSaving={isSaving}
        onSave={onSave}
        onCancel={onCancel}
      />
    </Modal>
  )
}
