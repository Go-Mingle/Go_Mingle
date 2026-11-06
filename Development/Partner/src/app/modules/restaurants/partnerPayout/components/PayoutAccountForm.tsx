import { useEffect } from 'react'
import { Form, Input, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../../atoms/AppButton'
import { ACCOUNT_TITLE_MAX } from '../constants'
import { formatIban, isValidPkIban } from '../iban'
import type { PayoutAccount, PayoutAccountField, SavePayoutAccountDto } from '../types'

interface PayoutAccountFormProps {
  account: PayoutAccount | null
  banks: string[]
  saving: boolean
  /** A server-side field error (422) to show under its input. */
  serverError: { field: PayoutAccountField; message: string } | null
  onSave: (body: SavePayoutAccountDto) => void
  onCancel?: () => void
}

/**
 * Account title, bank and IBAN. When editing, the IBAN starts as the masked
 * number on file; leaving it as is keeps that number.
 */
export function PayoutAccountForm({ account, banks, saving, serverError, onSave, onCancel }: PayoutAccountFormProps) {
  const { t } = useTranslation('restaurants')
  const [form] = Form.useForm<SavePayoutAccountDto>()

  useEffect(() => {
    if (serverError) form.setFields([{ name: serverError.field, errors: [serverError.message] }])
  }, [serverError, form])

  const keepsSavedIban = (value: string) => Boolean(account) && value.trim() === account?.ibanMasked

  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={false}
      className="app-form max-w-xl"
      initialValues={{
        accountTitle: account?.accountTitle ?? '',
        bankName: account?.bankName,
        iban: account?.ibanMasked ?? '',
      }}
      onFinish={(values) =>
        onSave({
          accountTitle: values.accountTitle.trim(),
          bankName: values.bankName,
          iban: keepsSavedIban(values.iban) ? values.iban.trim() : formatIban(values.iban),
        })
      }
    >
      <Form.Item
        name="accountTitle"
        label={t('payoutAccount.fields.accountTitle')}
        rules={[{ required: true, whitespace: true, message: t('payoutAccount.errors.accountTitle') }]}
      >
        <Input maxLength={ACCOUNT_TITLE_MAX} placeholder={t('payoutAccount.placeholders.accountTitle')} />
      </Form.Item>
      <Form.Item
        name="bankName"
        label={t('payoutAccount.fields.bankName')}
        rules={[{ required: true, message: t('payoutAccount.errors.bankName') }]}
      >
        <Select
          showSearch
          placeholder={t('payoutAccount.placeholders.bankName')}
          options={banks.map((b) => ({ value: b, label: b }))}
        />
      </Form.Item>
      <Form.Item
        name="iban"
        label={t('payoutAccount.fields.iban')}
        extra={account ? t('payoutAccount.ibanKeepHint') : t('payoutAccount.ibanHint')}
        rules={[
          {
            validator: (_, value: string = '') =>
              keepsSavedIban(value) || isValidPkIban(value)
                ? Promise.resolve()
                : Promise.reject(new Error(t('payoutAccount.errors.iban'))),
          },
        ]}
      >
        <Input placeholder="PK36 SCBL 0000 0011 2345 6702" autoComplete="off" />
      </Form.Item>
      <div className="flex gap-2">
        <AppButton variant="primary" type="submit" disabled={saving}>
          {saving ? t('payoutAccount.saving') : t('payoutAccount.save')}
        </AppButton>
        {onCancel && (
          <AppButton variant="neutral" type="button" onClick={onCancel} disabled={saving}>
            {t('payoutAccount.cancel')}
          </AppButton>
        )}
      </div>
    </Form>
  )
}
