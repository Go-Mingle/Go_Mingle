import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Form, Input, Radio, Button, Select, Spin } from 'antd'
import { Check, Info, Plus, X } from '@phosphor-icons/react'
import { AppButton } from '../../../atoms/AppButton'
import type {
  PreferenceQuestionListItem,
  PreferenceQuestionType,
  CreatePreferenceQuestionInput,
  UpdatePreferenceQuestionInput,
} from '../types'
import { useGetPreferenceQuestionQuery } from '../hooks/usePreferenceQuestionsQuery'

type OptionFieldValue = { id?: string; value: string }

type QuestionFormValues = {
  question: string
  type: PreferenceQuestionType
  questionOrder: number
  options: OptionFieldValue[]
}

interface QuestionFormModalProps {
  open: boolean
  editing: PreferenceQuestionListItem | null
  totalCount: number
  onClose: () => void
  onFinish: (
    v: CreatePreferenceQuestionInput | UpdatePreferenceQuestionInput,
    mode: 'create' | 'edit',
  ) => void
  submitting?: boolean
}

export function QuestionFormModal({
  open,
  editing,
  totalCount,
  onClose,
  onFinish,
  submitting = false,
}: QuestionFormModalProps) {
  const { t } = useTranslation('preference-questions')
  const [form] = Form.useForm<QuestionFormValues>()

  const { data: detailData, isLoading } = useGetPreferenceQuestionQuery(editing?.id ?? null)

  // When creating, the new question can take any slot from 1..totalCount+1.
  // When editing, the question already occupies a slot so the range is 1..totalCount.
  const maxOrder = editing ? Math.max(1, totalCount) : Math.max(1, totalCount + 1)
  const orderOptions = Array.from({ length: maxOrder }, (_, i) => ({
    label: String(i + 1),
    value: i + 1,
  }))

  const createDefaults = useMemo<QuestionFormValues>(
    () => ({
      question: '',
      type: 'SINGLE_SELECT',
      questionOrder: maxOrder,
      options: [{ value: '' }],
    }),
    [maxOrder],
  )

  const formInitialValues: QuestionFormValues =
    editing && detailData
      ? {
          question: detailData.question,
          type: detailData.type,
          questionOrder: detailData.questionOrder,
          options: detailData.options.map((o) => ({ id: o.id, value: o.text })),
        }
      : createDefaults

  // Form is created once via useForm() and its internal field store persists
  // across modal open/close cycles (destroyOnClose only unmounts the DOM, not
  // the store), so the `initialValues` prop alone won't clear stale values —
  // we must explicitly (re)populate the store every time the modal opens for
  // a given target, and clear it when it closes.
  useEffect(() => {
    if (!open) {
      form.resetFields()
      return
    }
    if (editing) {
      if (detailData) {
        form.setFieldsValue({
          question: detailData.question,
          type: detailData.type,
          questionOrder: detailData.questionOrder,
          options: detailData.options.map((o) => ({ id: o.id, value: o.text })),
        })
      }
      return
    }
    form.setFieldsValue(createDefaults)
  }, [open, editing, detailData, createDefaults, form])

  const handleFinish = (values: QuestionFormValues) => {
    const options = values.options ?? []
    if (editing) {
      onFinish(
        {
          question: values.question.trim(),
          type: values.type,
          questionOrder: Number(values.questionOrder),
          options: options.map((o) => ({ id: o.id, text: o.value.trim() })),
        },
        'edit',
      )
    } else {
      onFinish(
        {
          question: values.question.trim(),
          type: values.type,
          questionOrder: Number(values.questionOrder),
          options: options.map((o) => ({ text: o.value.trim() })),
        },
        'create',
      )
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={editing ? t('form.editTitle') : t('form.newTitle')}
      width={520}
      destroyOnClose
    >
      {editing && isLoading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          className="app-form"
          requiredMark={false}
          initialValues={formInitialValues}
          onFinish={handleFinish}
        >
          <Form.Item
            name="question"
            label={t('form.questionLabel')}
            rules={[{ required: true, message: t('form.questionRequired') }]}
          >
            <Input
              placeholder={t('form.questionPlaceholder')}
              style={{ height: 40, borderRadius: 8 }}
            />
          </Form.Item>

          <Form.Item
            name="type"
            label={t('form.typeLabel')}
            rules={[{ required: true, message: t('form.required') }]}
            style={{ marginBottom: 12 }}
          >
            <Radio.Group>
              <Radio
                value="SINGLE_SELECT"
                style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13 }}
              >
                {t('type.single')}
              </Radio>
              <Radio
                value="MULTI_SELECT"
                style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13 }}
              >
                {t('type.multi')}
              </Radio>
            </Radio.Group>
          </Form.Item>

          {/* Options — multiple options for BOTH types.
              The only runtime difference is that minglers can pick more than one
              answer when the question is multi-select. */}
          <Form.Item label={t('form.optionsLabel')} style={{ marginBottom: 12 }}>
            <Form.List
              name="options"
              rules={[
                {
                  validator: async (_, values: OptionFieldValue[]) => {
                    const filled = (values ?? [])
                      .map((v) => (v?.value ?? '').trim())
                      .filter(Boolean)
                    if (filled.length < 2) {
                      return Promise.reject(new Error(t('form.minTwoOptions')))
                    }
                    if (new Set(filled.map((v) => v.toLowerCase())).size !== filled.length) {
                      return Promise.reject(new Error(t('form.duplicateOption')))
                    }
                  },
                },
              ]}
            >
              {(fields, { add, remove }, { errors }) => (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {fields.map((field) => (
                      <div
                        key={field.key}
                        style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}
                      >
                        {/* Hidden id field — carries existing option ID for PATCH diff */}
                        <Form.Item name={[field.name, 'id']} hidden noStyle>
                          <Input />
                        </Form.Item>
                        <Form.Item
                          name={[field.name, 'value']}
                          rules={[{ required: true, message: t('form.required') }]}
                          style={{ flex: 1, marginBottom: 0 }}
                        >
                          <Input
                            placeholder={t('form.optionPlaceholder')}
                            style={{ height: 40, borderRadius: 8 }}
                          />
                        </Form.Item>
                        <button
                          type="button"
                          onClick={() => remove(field.name)}
                          aria-label={t('form.removeOption')}
                          disabled={fields.length <= 1}
                          style={{
                            flexShrink: 0,
                            width: 40,
                            height: 40,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 12,
                            background: 'transparent',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-muted)',
                            cursor: fields.length <= 1 ? 'not-allowed' : 'pointer',
                            opacity: fields.length <= 1 ? 0.5 : 1,
                          }}
                        >
                          <X size={14} weight="bold" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => add({ value: '' })}
                    style={{
                      marginTop: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 32,
                      padding: '0 14px',
                      borderRadius: 12,
                      background: 'var(--color-accent-light)',
                      color: 'var(--color-accent-dark)',
                      border: '1.5px solid var(--color-accent)',
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={12} weight="bold" />
                    {t('form.addOption')}
                  </button>
                  <Form.ErrorList errors={errors} />
                </>
              )}
            </Form.List>
          </Form.Item>

          <Form.Item
            name="questionOrder"
            label={t('form.orderLabel')}
            rules={[{ required: true, message: t('form.orderRequired') }]}
            extra={
              <span
                style={{
                  display: 'block',
                  width: '100%',
                  fontSize: 11,
                  color: 'var(--color-text-subtle)',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {t('form.orderHelper')}
              </span>
            }
            style={{ marginBottom: 12 }}
          >
            <Select options={orderOptions} size="large" style={{ width: '100%', height: 40 }} />
          </Form.Item>

          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              background: 'var(--color-accent-light)',
              borderRadius: 8,
              padding: '10px 14px',
              marginTop: 4,
            }}
          >
            <Info
              size={15}
              weight="regular"
              style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: 1 }}
            />
            <span
              style={{
                fontSize: 12,
                color: 'var(--color-accent-dark)',
                fontFamily: 'Poppins, sans-serif',
                lineHeight: 1.6,
              }}
            >
              {t('form.infoCallout')}
            </span>
          </div>

          <div className="app-modal-footer">
            <Button
              onClick={onClose}
              style={{
                height: 36,
                borderRadius: 12,
                fontFamily: 'Poppins, sans-serif',
                fontSize: 13,
              }}
            >
              {t('form.cancel')}
            </Button>
            <AppButton type="submit" loading={submitting} style={{ padding: '0 20px' }}>
              <Check size={14} weight="bold" />
              {editing ? t('form.saveChanges') : t('form.createQuestion')}
            </AppButton>
          </div>
        </Form>
      )}
    </Modal>
  )
}
