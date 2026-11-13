import { useEffect } from 'react'
import { Form, Input, InputNumber, Modal, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { useInterestTableOptions } from '../hooks/useEscrow'
import type { EscrowRestaurantOption, TestBookingRequest } from '../types'

interface ReasonModalProps {
  open: boolean
  title: string
  confirmLabel: string
  required: boolean
  loading: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
}

/** Asks for the reason a hold is voided or a payment is refunded. */
export function ReasonModal({
  open,
  title,
  confirmLabel,
  required,
  loading,
  onCancel,
  onConfirm,
}: ReasonModalProps) {
  const { t } = useTranslation('finances')
  const [form] = Form.useForm<{ reason: string }>()

  useEffect(() => {
    if (open) form.resetFields()
  }, [open, form])

  return (
    <Modal
      open={open}
      title={title}
      okText={confirmLabel}
      cancelText={t('escrow.cancel')}
      confirmLoading={loading}
      onCancel={onCancel}
      onOk={() => {
        form
          .validateFields()
          .then((v) => onConfirm(v.reason?.trim() ?? ''))
          .catch(() => undefined)
      }}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="reason"
          label={t('escrow.reason')}
          rules={
            required
              ? [{ required: true, whitespace: true, message: t('escrow.reasonRequired') }]
              : []
          }
        >
          <Input.TextArea rows={3} maxLength={300} placeholder={t('escrow.reasonPlaceholder')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

interface TestBookingModalProps {
  open: boolean
  restaurants: EscrowRestaurantOption[]
  loading: boolean
  onCancel: () => void
  onSubmit: (body: TestBookingRequest) => void
}

/** Places a sandbox card hold, as the Mingler app would when a seat is booked. */
export function TestBookingModal({
  open,
  restaurants,
  loading,
  onCancel,
  onSubmit,
}: TestBookingModalProps) {
  const { t } = useTranslation('finances')
  const [form] = Form.useForm<TestBookingRequest>()

  const restaurantId = Form.useWatch('restaurantId', form)
  const interestTableId = Form.useWatch('interestTableId', form)
  const tables = useInterestTableOptions(open ? restaurantId : undefined)

  useEffect(() => {
    if (open) form.resetFields()
  }, [open, form])

  return (
    <Modal
      open={open}
      title={t('escrow.testBooking.title')}
      okText={t('escrow.testBooking.submit')}
      cancelText={t('escrow.cancel')}
      confirmLoading={loading}
      onCancel={onCancel}
      onOk={() => {
        form
          .validateFields()
          .then(onSubmit)
          .catch(() => undefined)
      }}
      destroyOnHidden
    >
      <p className="text-sm text-(--color-text-muted) mt-0 mb-4">{t('escrow.testBooking.body')}</p>
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ guests: 2, amountPerGuest: 3000, minglerName: '' }}
      >
        <Form.Item
          name="restaurantId"
          label={t('escrow.testBooking.restaurant')}
          rules={[{ required: true, message: t('escrow.testBooking.restaurantRequired') }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={t('escrow.testBooking.restaurantPlaceholder')}
            onChange={() => form.setFieldValue('interestTableId', undefined)}
            options={restaurants.map((r) => ({
              value: r.id,
              label: r.hasPayoutAccount ? r.name : `${r.name} — ${t('escrow.noPayoutAccount')}`,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="interestTableId"
          label={t('escrow.testBooking.interestTable')}
          extra={
            interestTableId
              ? t('escrow.testBooking.interestTableHelp')
              : t('escrow.testBooking.interestTableOptional')
          }
        >
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            disabled={!restaurantId}
            loading={tables.isFetching}
            placeholder={t('escrow.testBooking.interestTablePlaceholder')}
            options={(tables.data?.items ?? []).map((it) => ({
              value: it.interestTableId,
              label: it.interestTableName,
            }))}
          />
        </Form.Item>
        <Form.Item name="minglerName" label={t('escrow.testBooking.mingler')}>
          <Input maxLength={80} placeholder="Zara Ali" />
        </Form.Item>
        {interestTableId && (
          <Form.Item
            name="minglerEmail"
            label={t('escrow.testBooking.minglerEmail')}
            extra={t('escrow.testBooking.minglerEmailHelp')}
            rules={[{ type: 'email', message: t('escrow.testBooking.minglerEmailInvalid') }]}
          >
            <Input maxLength={120} placeholder="zara@example.com" />
          </Form.Item>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Form.Item
            name="guests"
            label={interestTableId ? t('escrow.testBooking.seats') : t('escrow.testBooking.guests')}
            rules={[{ required: true }]}
          >
            <InputNumber min={1} max={8} className="w-full" />
          </Form.Item>
          {/* At an interest table this is the dinner price; the card hold is the restaurant's no-show penalty. */}
          <Form.Item
            name="amountPerGuest"
            label={
              interestTableId
                ? t('escrow.testBooking.seatPrice')
                : t('escrow.testBooking.amountPerGuest')
            }
            rules={[{ required: true }]}
          >
            <InputNumber min={100} max={100000} step={100} className="w-full" />
          </Form.Item>
        </div>
        {interestTableId && (
          <p className="text-xs text-(--color-text-muted) m-0">
            {t('escrow.testBooking.seatPriceHelp')}
          </p>
        )}
      </Form>
    </Modal>
  )
}
