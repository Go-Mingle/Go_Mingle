import { Alert, Form, Input, Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import { useCreateRestaurantMutation } from './hooks'
import type { CreateRestaurantPayload, CreateRestaurantResult } from './types'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (created: CreateRestaurantResult) => void
}

/**
 * Creates a restaurant profile with just its name and owner. The owner is
 * emailed, signs up with that email (or Google), adds the rest and sends the
 * profile for approval.
 */
export function AddRestaurantModal({ open, onClose, onCreated }: Readonly<Props>) {
  const { t } = useTranslation('restaurants')
  const [form] = Form.useForm<CreateRestaurantPayload>()
  const create = useCreateRestaurantMutation()

  const close = () => {
    form.resetFields()
    create.reset()
    onClose()
  }

  const submit = async () => {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    create.mutate(
      {
        name: values.name.trim(),
        ownerName: values.ownerName.trim(),
        ownerEmail: values.ownerEmail.trim().toLowerCase(),
        ownerPhone: values.ownerPhone?.trim() || undefined,
      },
      {
        onSuccess: (created) => {
          form.resetFields()
          onCreated(created)
        },
      },
    )
  }

  const error = create.error ? getApiErrorMessage(create.error, t('access.add.failed')) : ''

  return (
    <Modal
      open={open}
      title={t('access.add.title')}
      okText={t('access.add.submit')}
      cancelText={t('access.cancel')}
      confirmLoading={create.isPending}
      onOk={() => void submit()}
      onCancel={close}
      destroyOnHidden
    >
      <p className="text-[13px] text-[var(--color-text-muted)] mt-0 mb-4">
        {t('access.add.intro')}
      </p>
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="name"
          label={t('access.add.name')}
          rules={[
            { required: true, whitespace: true, min: 2, message: t('access.add.nameRequired') },
          ]}
        >
          <Input maxLength={120} placeholder="Kolachi" />
        </Form.Item>
        <Form.Item
          name="ownerName"
          label={t('access.add.ownerName')}
          rules={[
            {
              required: true,
              whitespace: true,
              min: 2,
              message: t('access.add.ownerNameRequired'),
            },
          ]}
        >
          <Input maxLength={120} placeholder="Raees Khan" />
        </Form.Item>
        <Form.Item
          name="ownerEmail"
          label={t('access.add.ownerEmail')}
          extra={t('access.add.ownerEmailHelp')}
          rules={[{ required: true, type: 'email', message: t('access.emailInvalid') }]}
        >
          <Input maxLength={200} placeholder="owner@restaurant.pk" />
        </Form.Item>
        <Form.Item
          name="ownerPhone"
          label={t('access.add.ownerPhone')}
          rules={[{ pattern: /^\+?[0-9 ()-]{7,20}$/, message: t('access.add.ownerPhoneInvalid') }]}
        >
          <Input maxLength={20} placeholder="+92 300 1234567" />
        </Form.Item>
      </Form>
      {error && <Alert type="error" showIcon message={error} />}
    </Modal>
  )
}
