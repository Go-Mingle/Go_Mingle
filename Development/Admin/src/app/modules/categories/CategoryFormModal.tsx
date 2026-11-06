import { useTranslation } from 'react-i18next'
import { Modal, Form, Input, Button } from 'antd'
import type { FormInstance } from 'antd'
import { Check, Info } from '@phosphor-icons/react'
import type { Category, CategoryFormValues } from './types'
import { AppButton } from '../../atoms/AppButton'

interface CategoryFormModalProps {
  open: boolean
  editing: Category | null
  form: FormInstance
  onClose: () => void
  onFinish: (v: CategoryFormValues) => void
  submitting?: boolean
}

export function CategoryFormModal({
  open,
  editing,
  form,
  onClose,
  onFinish,
  submitting = false,
}: CategoryFormModalProps) {
  const { t } = useTranslation('categories')

  const handleFinish = (values: CategoryFormValues) => {
    onFinish({
      name: values.name.trim(),
      commissionRate: Number(values.commissionRate),
    })
  }

  const rateValidator = (msg: string) => ({
    validator(_: unknown, v: unknown) {
      const str = String(v ?? '').trim()
      if (!str) return Promise.resolve()
      const n = Number(str)
      return !isNaN(n) && n >= 1 && n <= 100 && /^\d+(\.\d{1,2})?$/.test(str)
        ? Promise.resolve()
        : Promise.reject(new Error(msg))
    },
  })

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={editing ? t('form.editTitle') : t('form.newTitle')}
      width={520}
      className="category-modal"
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        className="app-form"
        requiredMark={false}
        onFinish={handleFinish}
      >
        {/* Category name */}
        <Form.Item
          name="name"
          label={t('form.categoryName')}
          rules={[{ required: true, message: t('form.categoryNameRequired') }]}
        >
          <Input placeholder={t('form.categoryNamePlaceholder')} className="h-10! rounded-lg!" />
        </Form.Item>

        {/* Booking commission */}
        <Form.Item
          name="commissionRate"
          label={t('form.commissionRate')}
          className="mt-4"
          rules={[
            { required: true, message: t('form.commissionRateRequired') },
            rateValidator(t('form.commissionRateRequired')),
          ]}
          extra={
            <span className="text-[11px] text-(--color-text-subtle) [font-family:var(--font-ui)]">
              {t('form.commissionRateHelper')}
            </span>
          }
        >
          <Input
            inputMode="decimal"
            placeholder={t('form.commissionRatePlaceholder')}
            suffix={
              <span className="text-[13px] text-(--color-text-subtle) [font-family:var(--font-ui)]">
                %
              </span>
            }
            className="h-10! rounded-lg! w-full"
          />
        </Form.Item>

        {/* Info callout */}
        <div className="flex gap-2 items-start bg-(--color-accent-light) rounded-lg px-3.5 py-2.5 mt-4">
          <Info size={15} weight="regular" color="var(--color-accent)" className="shrink-0 mt-px" />
          <span className="text-xs text-accent-dark [font-family:var(--font-ui)] leading-[1.6]">
            {t('form.infoCallout')}
          </span>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-(--color-border)">
          <Button
            onClick={onClose}
            className="h-9! rounded-xl! [font-family:var(--font-ui)] text-[13px]!"
          >
            {t('form.cancel')}
          </Button>
          <AppButton type="submit" loading={submitting} style={{ padding: '0 20px' }}>
            <Check size={14} weight="bold" />
            {editing ? t('form.saveChanges') : t('form.createCategory')}
          </AppButton>
        </div>
      </Form>
    </Modal>
  )
}
