import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Form, Input, Select } from 'antd'
import type { FormInstance } from 'antd'
import { Check, Plus } from '@phosphor-icons/react'
import { AppButton } from '../../atoms/AppButton'
import type { Interest } from './types'

interface InterestFormModalProps {
  open: boolean
  editing: Interest | null
  form: FormInstance
  /** Existing category names for the "select or type" field. */
  categoryOptions: string[]
  onClose: () => void
  onFinish: (v: { name: string; groupName: string }) => void
  submitting?: boolean
}

export function InterestFormModal({
  open,
  editing,
  form,
  categoryOptions,
  onClose,
  onFinish,
  submitting = false,
}: InterestFormModalProps) {
  const { t } = useTranslation('interests')
  const [search, setSearch] = useState('')

  const handleFinish = (values: { name: string; groupName: string }) => {
    onFinish({ name: values.name.trim(), groupName: values.groupName.trim() })
  }

  const categoryDropdownOptions = useMemo(() => {
    const q = search.trim()
    const ql = q.toLowerCase()
    const exact = categoryOptions.some((c) => c.toLowerCase() === ql)
    const opts: { value: string; label: React.ReactNode }[] = categoryOptions
      .filter((c) => c.toLowerCase().includes(ql))
      .map((c) => ({ value: c, label: c }))
    // Offer to create a new category when the typed text matches nothing existing.
    if (q && !exact) {
      opts.unshift({
        value: q,
        label: (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--color-accent)',
              fontWeight: 600,
            }}
          >
            <Plus size={13} weight="bold" />
            {t('form.createCategoryOption', { name: q })}
          </span>
        ),
      })
    }
    return opts
  }, [categoryOptions, search, t])

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={editing ? t('form.editTitle') : t('form.newTitle')}
      width={460}
      closable
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        className="app-form"
        requiredMark={false}
        onFinish={handleFinish}
      >
        <Form.Item
          name="groupName"
          label={t('form.category')}
          rules={[{ required: true, whitespace: true, message: t('form.categoryRequired') }]}
          extra={
            <span
              style={{
                fontSize: 11,
                color: 'var(--color-text-subtle)',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {t('form.categoryHelper')}
            </span>
          }
        >
          <Select
            showSearch
            placeholder={t('form.categoryPlaceholder')}
            options={categoryDropdownOptions}
            filterOption={false}
            searchValue={search}
            onSearch={setSearch}
            onSelect={() => setSearch('')}
            onBlur={() => setSearch('')}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          name="name"
          label={t('form.name')}
          rules={[{ required: true, whitespace: true, message: t('form.nameRequired') }]}
        >
          <Input placeholder={t('form.namePlaceholder')} style={{ height: 40, borderRadius: 8 }} />
        </Form.Item>

        <div className="app-modal-footer">
          <AppButton variant="neutral" onClick={onClose}>
            {t('form.cancel')}
          </AppButton>
          <AppButton variant="primary" type="submit" loading={submitting}>
            <Check size={14} weight="bold" />
            {editing ? t('form.saveChanges') : t('form.createInterest')}
          </AppButton>
        </div>
      </Form>
    </Modal>
  )
}
