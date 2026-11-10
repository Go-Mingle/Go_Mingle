import { useEffect, useMemo } from 'react'
import { Modal, Form, Input, Checkbox, Spin, Alert } from 'antd'
import type { FormInstance } from 'antd'
import { Check } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { SecondaryActionButton } from '../../atoms/ModalActions'
import { AppButton } from '../../atoms/AppButton'
import { usePermissionKeysQuery } from './hooks/useRolesQuery'
import type { Role, RoleModule } from './types'

interface RoleFormModalProps {
  open: boolean
  editing: Role | null
  existingRoles?: Role[]
  fullAccess: boolean
  setFullAccess: (v: boolean) => void
  form: FormInstance
  onFinish: (values: Role) => void
  onCancel: () => void
  submitting?: boolean
}

export function RoleFormModal({
  open,
  editing,
  existingRoles,
  fullAccess,
  setFullAccess,
  form,
  onFinish,
  onCancel,
  submitting = false,
}: RoleFormModalProps) {
  const { t } = useTranslation('roles-access')
  // Permission catalogue is fetched from the backend (single source of truth
  // for the canonical keys + their display labels) rather than hardcoded here.
  const { data: catalogue, isPending: permsLoading, isError: permsError } = usePermissionKeysQuery()
  const sections = useMemo(() => catalogue?.sections ?? [], [catalogue])
  const watchedPermissions: string[] = Form.useWatch('permissions', form) ?? []
  const watchedName: string = Form.useWatch('name', form) ?? ''

  // Every permission key across all sections — used to materialise "full access"
  // as an all-selected set so the checkboxes stay editable (not disabled).
  const allKeys = useMemo(
    () => sections.flatMap((section) => section.permissions.map((p) => p.key)),
    [sections],
  )

  const isValid = watchedName.trim().length >= 2 && (fullAccess || watchedPermissions.length > 0)

  // Full Access is now just a shortcut that ticks every module; the boxes remain
  // enabled. Editing a stored full-access role arrives with permissions:[], so
  // once the catalogue loads we populate it to reflect the ticked state.
  useEffect(() => {
    if (open && fullAccess && allKeys.length > 0 && watchedPermissions.length === 0) {
      form.setFieldValue('permissions', allKeys)
    }
  }, [open, fullAccess, allKeys, watchedPermissions.length, form])

  const setFullAccessToggle = (next: boolean) => {
    setFullAccess(next)
    form.setFieldValue('permissions', next ? allKeys : [])
  }

  const togglePermission = (key: string) => {
    const current: string[] = form.getFieldValue('permissions') ?? []
    const removing = current.includes(key)
    const next = removing ? current.filter((k: string) => k !== key) : [...current, key]
    form.setFieldValue('permissions', next)
    // Unticking any single module means the role no longer has full access.
    if (removing && fullAccess) setFullAccess(false)
  }

  const handleSave = () => form.submit()

  const renderModuleCard = (mod: RoleModule) => {
    const selected = watchedPermissions.includes(mod.key)
    return (
      <div
        key={mod.key}
        onClick={() => togglePermission(mod.key)}
        className={[
          'flex items-center gap-2.5 py-2.5 px-3.5 rounded-xl border transition-all duration-150 ease-out select-none cursor-pointer',
          selected
            ? 'bg-(--color-accent-light) border-accent'
            : 'bg-(--color-page) border-(--color-border)',
        ].join(' ')}
      >
        <Checkbox
          checked={selected}
          onChange={() => togglePermission(mod.key)}
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
        <span
          className={[
            'font-[Poppins] text-[13px]',
            selected
              ? 'font-semibold text-accent-dark'
              : 'font-normal text-(--color-text-secondary)',
          ].join(' ')}
        >
          {mod.label}
        </span>
      </div>
    )
  }

  const sectionHeading = (label: string) => (
    <div className="font-[Poppins] text-[11px] font-bold tracking-widest uppercase text-(--color-text-subtle) mt-4 mb-2.5">
      {label}
    </div>
  )

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={
        <span className="text-[20px] font-semibold">
          {editing ? t('form.editTitle') : t('form.newTitle')}
        </span>
      }
      footer={null}
      width={520}
      destroyOnClose
      className="role-modal"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        requiredMark={false}
        className="app-form mt-4"
      >
        <Form.Item
          label={t('form.roleName')}
          name="name"
          rules={[
            { required: true, message: 'Role name is required' },
            { min: 2, max: 60, message: 'Role name must be between 2 and 60 characters' },
            {
              validator: async (_: unknown, value: string) => {
                const trimmed = (value ?? '').trim().toLowerCase()
                if (trimmed.length < 2) return
                const isDuplicate = (existingRoles ?? []).some(
                  (r) =>
                    (r.name as string).toLowerCase() === trimmed &&
                    r.id !== editing?.id &&
                    !r.deleted_at,
                )
                if (isDuplicate) throw new Error('A role with this name already exists')
              },
            },
          ]}
        >
          <Input size="large" />
        </Form.Item>

        {/* Full Access row — checkbox aligned to the top of the label block */}
        <Form.Item className="mb-5!">
          <div
            className="flex items-start gap-3 py-3 px-3.5 bg-(--color-page) border border-(--color-border) rounded-xl cursor-pointer"
            onClick={() => setFullAccessToggle(!fullAccess)}
          >
            <Checkbox
              checked={fullAccess}
              onChange={(e) => setFullAccessToggle(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="font-[Poppins] text-sm font-semibold text-(--color-text) leading-[1.4]">
                {t('form.fullAccess')}
              </div>
              <div className="mt-1 font-[Poppins] text-xs font-normal text-(--color-text-muted) leading-normal">
                {t('form.fullAccessLabel')}
              </div>
            </div>
          </div>
        </Form.Item>

        {/* Module permissions, grouped by sidebar section */}
        <Form.Item className="mb-5!">
          {/* Hidden field so form submission captures the value */}
          <Form.Item name="permissions" noStyle>
            <input type="hidden" />
          </Form.Item>

          {permsLoading ? (
            <div className="flex justify-center py-6">
              <Spin />
            </div>
          ) : permsError ? (
            <Alert type="error" message={t('common:errors.fetchError')} />
          ) : (
            sections.map((section) => (
              <div key={section.section}>
                {sectionHeading(section.section)}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 w-full">
                  {section.permissions.map(renderModuleCard)}
                </div>
              </div>
            ))
          )}
        </Form.Item>

        <div className="app-modal-footer">
          <SecondaryActionButton onClick={onCancel}>{t('form.cancel')}</SecondaryActionButton>
          <AppButton
            type="button"
            onClick={handleSave}
            disabled={!isValid}
            loading={submitting}
            style={{ padding: '0 20px' }}
          >
            <Check size={14} weight="bold" />
            {editing ? t('form.saveChanges') : t('form.createRole')}
          </AppButton>
        </div>
      </Form>
    </Modal>
  )
}
