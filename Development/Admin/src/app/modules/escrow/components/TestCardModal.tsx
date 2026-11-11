import { useEffect } from 'react'
import { Alert, Form, Input, Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import { HttpError } from '../../../../shared/api/httpClient'
import type { TestCardRequest } from '../types'

/** The test numbers the server accepts. Anything else is refused there too. */
const TEST_CARD_NUMBERS = ['4111 1111 1111 1111', '5555 5555 5555 4444'] as const
const DECLINING_TEST_CARD = '4000 0000 0000 0002'
const ALL_TEST_CARDS: string[] = [...TEST_CARD_NUMBERS, DECLINING_TEST_CARD].map((n) => n.replace(/\s/g, ''))

interface FormValues {
  cardNumber: string
  expiry: string
  cvc: string
}

interface TestCardModalProps {
  open: boolean
  bookingRef: string
  loading: boolean
  /** The server's answer to the last attempt, shown inside the dialog. */
  error: unknown
  onCancel: () => void
  onSubmit: (body: TestCardRequest) => void
}

function serverMessage(error: unknown): string | null {
  if (!(error instanceof HttpError)) return null
  const body = error.responseBody as { error?: { message?: string; details?: { fields?: Record<string, string> } } } | null
  const fields = body?.error?.details?.fields
  return (fields && Object.values(fields)[0]) || body?.error?.message || null
}

/**
 * TEMPORARY (GM-255): the card step of a sandbox booking, done by an admin
 * until the Mingler app takes the card.
 *
 * Only test card numbers are accepted, here and on the server, so a real card
 * can never be entered. The hold is then settled by the simulator; nothing is
 * sent to Safepay and the number is not stored.
 */
export function TestCardModal({ open, bookingRef, loading, error, onCancel, onSubmit }: TestCardModalProps) {
  const { t } = useTranslation('finances')
  const [form] = Form.useForm<FormValues>()

  useEffect(() => {
    if (open) form.resetFields()
  }, [open, form])

  const refused = serverMessage(error)

  return (
    <Modal
      open={open}
      title={t('escrow.testCard.title', { ref: bookingRef })}
      okText={t('escrow.testCard.submit')}
      cancelText={t('escrow.cancel')}
      confirmLoading={loading}
      onCancel={onCancel}
      onOk={() => {
        form
          .validateFields()
          .then((v) => {
            const [month, year] = v.expiry.split('/')
            onSubmit({
              cardNumber: v.cardNumber.replace(/\s/g, ''),
              expMonth: Number(month),
              expYear: 2000 + Number(year),
              cvc: v.cvc,
            })
          })
          .catch(() => undefined)
      }}
      destroyOnHidden
    >
      <Alert
        type="warning"
        showIcon
        className="mb-4"
        message={t('escrow.testCard.warningTitle')}
        description={t('escrow.testCard.warning', { cards: TEST_CARD_NUMBERS.join(' · '), declined: DECLINING_TEST_CARD })}
      />
      {refused && <Alert type="error" showIcon className="mb-4" message={refused} />}
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ cardNumber: TEST_CARD_NUMBERS[0] }}>
        <Form.Item
          name="cardNumber"
          label={t('escrow.testCard.number')}
          rules={[
            {
              validator: (_rule, value: string) =>
                ALL_TEST_CARDS.includes(String(value ?? '').replace(/[\s-]/g, ''))
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('escrow.testCard.onlyTestCards'))),
            },
          ]}
        >
          <Input inputMode="numeric" maxLength={23} autoComplete="off" />
        </Form.Item>
        <div className="grid grid-cols-2 gap-3">
          <Form.Item
            name="expiry"
            label={t('escrow.testCard.expiry')}
            rules={[{ required: true, pattern: /^(0[1-9]|1[0-2])\/\d{2}$/, message: t('escrow.testCard.expiryInvalid') }]}
          >
            <Input placeholder="MM/YY" maxLength={5} autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="cvc"
            label={t('escrow.testCard.cvc')}
            rules={[{ required: true, pattern: /^\d{3,4}$/, message: t('escrow.testCard.cvcInvalid') }]}
          >
            <Input inputMode="numeric" maxLength={4} autoComplete="off" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}
