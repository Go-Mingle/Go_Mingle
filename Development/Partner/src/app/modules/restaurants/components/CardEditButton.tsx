import { useState } from 'react'
import { Modal, Form, Input, Select, message } from 'antd'
import { PencilSimple } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../atoms/AppButton'
import { useUpdateRestaurantCardMutation } from '../hooks/useUpdateRestaurantCardMutation'
import { PlacesAutocompleteInput } from './PlacesAutocompleteInput'

export interface EditField {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'email' | 'url' | 'tel' | 'select' | 'address'
  options?: { value: string | boolean; label: string }[]
  required?: boolean
  /** Overrides the pre-filled value (for derived fields not stored directly). */
  initialValue?: unknown
}

interface EditConfig {
  fields: EditField[]
  restaurant: Record<string, unknown>
  /** Derive extra fields on save (e.g. sync categoryId from the chosen category). */
  transformPatch?: (values: Record<string, unknown>) => Record<string, unknown>
}

interface CardEditButtonProps {
  /** Card/section title, shown in the modal and used for the accessible label. */
  title: string
  /** Icon button size in px. */
  size?: number
  /** When provided, the modal renders an editable, API-backed form. */
  edit?: EditConfig
}

/**
 * Edit affordance shown on each detail card. With an `edit` config it opens a
 * form pre-filled with the current values and saves changes through the API;
 * without one it shows a placeholder (used on pages not yet wired for editing).
 */
export function CardEditButton({ title, size = 16, edit }: CardEditButtonProps) {
  const { t } = useTranslation(['restaurants', 'common'])
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [messageApi, contextHolder] = message.useMessage()

  const restaurantId = edit?.restaurant.id as string | undefined

  const mutation = useUpdateRestaurantCardMutation(restaurantId)

  const initialValues = edit
    ? Object.fromEntries(
        edit.fields.map((f) => [
          f.key,
          f.initialValue !== undefined ? f.initialValue : (edit.restaurant[f.key] ?? undefined),
        ]),
      )
    : {}

  const handleFinish = (values: Record<string, unknown>) => {
    const patch = edit?.transformPatch ? edit.transformPatch(values) : values
    mutation.mutate(patch, {
      onSuccess: () => {
        void messageApi.success(t('edit.saved', { title }))
        setOpen(false)
      },
      onError: () => {
        void messageApi.error(t('edit.saveFailed'))
      },
    })
  }

  return (
    <>
      {contextHolder}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('edit.ariaLabel', { title })}
        title={t('edit.tooltip')}
        className="shrink-0 w-8 h-8 rounded-[var(--radius-sm)] border-none bg-transparent flex items-center justify-center cursor-pointer text-[var(--color-text-subtle)] md:hover:bg-[var(--color-hover-neutral)] md:hover:text-[var(--color-accent)] transition-colors"
      >
        <PencilSimple size={size} />
      </button>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        title={t('edit.modalTitle', { title })}
        footer={null}
        width={520}
        destroyOnHidden
      >
        {edit ? (
          <Form
            form={form}
            layout="vertical"
            initialValues={initialValues}
            requiredMark={false}
            className="app-form pt-1"
            onFinish={handleFinish}
          >
            {edit.fields.map((f) => (
              <Form.Item
                key={f.key}
                name={f.key}
                label={f.label}
                rules={
                  f.required
                    ? [{ required: true, message: t('edit.required', { label: f.label }) }]
                    : undefined
                }
              >
                {f.type === 'select' ? (
                  <Select options={f.options} size="large" allowClear />
                ) : f.type === 'address' ? (
                  <PlacesAutocompleteInput placeholder={t('edit.addressPlaceholder')} />
                ) : f.type === 'textarea' ? (
                  <Input.TextArea rows={3} size="large" />
                ) : (
                  <Input type={f.type ?? 'text'} size="large" />
                )}
              </Form.Item>
            ))}
            <div className="app-modal-footer">
              <AppButton variant="neutral" onClick={() => setOpen(false)}>
                {t('common:buttons.cancel')}
              </AppButton>
              <AppButton variant="primary" type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? t('edit.saving') : t('edit.save')}
              </AppButton>
            </div>
          </Form>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            {t('edit.placeholder', { title })}
          </p>
        )}
      </Modal>
    </>
  )
}
