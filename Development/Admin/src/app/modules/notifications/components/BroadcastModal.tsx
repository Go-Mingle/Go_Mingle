import { useState } from 'react'
import { Form, Input, Modal, Radio, Select, message } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { httpClient } from '../../../../shared/api/httpClient'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import { useBroadcastMutation } from '../hooks/useNotificationsQuery'

interface Props {
  open: boolean
  onClose: () => void
}

type Values = { title: string; body: string; to: 'all' | 'some'; restaurantIds: string[] }

/** "Message restaurants": a message from GoMingle to Partner Portal inboxes (GM-342). */
export function BroadcastModal({ open, onClose }: Props) {
  const { t } = useTranslation('notifications')
  const [form] = Form.useForm<Values>()
  const [messageApi, holder] = message.useMessage()
  const [to, setTo] = useState<'all' | 'some'>('all')
  const send = useBroadcastMutation()
  const restaurants = useQuery({
    queryKey: ['restaurants', 'broadcast-picker'],
    queryFn: () =>
      httpClient.get<{ items: { id: string; name: string }[] }>('/api/v1/restaurants?pageSize=100'),
    enabled: open && to === 'some',
  })

  const submit = async () => {
    const v = await form.validateFields()
    send.mutate(
      {
        title: v.title.trim(),
        body: v.body.trim(),
        ...(v.to === 'some' ? { restaurantIds: v.restaurantIds } : {}),
      },
      {
        onSuccess: (r) => {
          void messageApi.success(t('broadcast.sent', { count: r.sent }))
          form.resetFields()
          setTo('all')
          onClose()
        },
        onError: (e) => void messageApi.error(getApiErrorMessage(e, t('broadcast.failed'))),
      },
    )
  }

  return (
    <>
      {holder}
      <Modal
        open={open}
        title={t('broadcast.title')}
        okText={t('broadcast.send')}
        cancelText={t('cancel')}
        okButtonProps={{ loading: send.isPending }}
        onOk={submit}
        onCancel={onClose}
        destroyOnHidden
      >
        <p className="text-[13px] text-[var(--color-text-muted)]">{t('broadcast.body')}</p>
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ to: 'all', restaurantIds: [] }}
        >
          <Form.Item name="to" label={t('broadcast.to')}>
            <Radio.Group onChange={(e) => setTo(e.target.value)}>
              <Radio value="all">{t('broadcast.all')}</Radio>
              <Radio value="some">{t('broadcast.some')}</Radio>
            </Radio.Group>
          </Form.Item>
          {to === 'some' && (
            <Form.Item
              name="restaurantIds"
              label={t('broadcast.choose')}
              rules={[{ required: true, type: 'array', min: 1 }]}
            >
              <Select
                mode="multiple"
                loading={restaurants.isPending}
                optionFilterProp="label"
                options={(restaurants.data?.items ?? []).map((r) => ({
                  value: r.id,
                  label: r.name,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item
            name="title"
            label={t('broadcast.msgTitle')}
            rules={[{ required: true, max: 120 }]}
          >
            <Input showCount maxLength={120} />
          </Form.Item>
          <Form.Item
            name="body"
            label={t('broadcast.msgBody')}
            rules={[{ required: true, max: 1000 }]}
          >
            <Input.TextArea rows={4} showCount maxLength={1000} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
