import { useState } from 'react'
import { Modal, message, Spin, Alert } from 'antd'
import { Check, CreditCard } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { SecondaryActionButton, PrimaryActionButton } from '../../../atoms/ModalActions'
import { MODAL_WIDTH } from '../../../atoms/modalWidth'
import {
  useMinglerPaymentMethodsQuery,
  useSetDefaultPaymentMethodMutation,
} from '../hooks/useMinglersQuery'
import { HttpError } from '../../../../shared/api/httpClient'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'

interface MinglerPaymentsTabProps {
  minglerId: string
  minglerName: string
  isActive: boolean
}

export function MinglerPaymentsTab({ minglerId, minglerName, isActive }: MinglerPaymentsTabProps) {
  const { t } = useTranslation('minglers')
  const [messageApi, contextHolder] = message.useMessage()
  const [defaultCardConfirm, setDefaultCardConfirm] = useState<string | null>(null)
  const { data, isPending, isError } = useMinglerPaymentMethodsQuery(minglerId, isActive)
  const setDefaultMutation = useSetDefaultPaymentMethodMutation()

  if (isPending) return <Spin className="flex justify-center mt-20" />
  if (isError) return <Alert type="error" message={t('common:errors.fetchError')} className="m-4" />

  const paymentMethods = data.items

  const handleConfirmSetDefault = () => {
    if (!defaultCardConfirm) return
    setDefaultMutation.mutate(
      { minglerId, paymentMethodId: defaultCardConfirm },
      {
        onSuccess: () => {
          setDefaultCardConfirm(null)
          void messageApi.success(t('messages.defaultCardChanged'))
        },
        onError: (err) => {
          setDefaultCardConfirm(null)
          // Card was removed since load — spec says the SPA just silently refreshes.
          if (err instanceof HttpError && err.code === 'ERR_PAYMENT_METHOD_NOT_FOUND') return
          void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))
        },
      },
    )
  }

  return (
    <>
      {contextHolder}
      <div
        style={{
          background: 'var(--color-card)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-sm)',
          padding: 24,
        }}
      >
        {paymentMethods.length === 0 ? (
          <p
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              color: 'var(--color-text-muted)',
              padding: '24px 0',
              margin: 0,
            }}
          >
            {t('payments.noPaymentMethods')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paymentMethods.map((pm) => (
              <div
                key={pm.paymentMethodId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: 16,
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 28,
                    background: 'var(--color-page)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CreditCard size={14} color="var(--color-text-muted)" />
                </div>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--color-text)',
                      margin: '0 0 2px',
                    }}
                  >
                    •••• •••• •••• {pm.last4}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>
                    {pm.cardType} · Expires {String(pm.expiryMonth).padStart(2, '0')}/
                    {String(pm.expiryYear).slice(-2)}
                  </p>
                </div>
                {pm.isDefault ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: 24,
                      padding: '0 10px',
                      borderRadius: 4,
                      background: 'var(--color-success)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {t('payments.defaultCard')}
                  </span>
                ) : (
                  <button
                    onClick={() => setDefaultCardConfirm(pm.paymentMethodId)}
                    style={{
                      fontSize: 12,
                      color: 'var(--color-accent)',
                      fontWeight: 500,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {t('payments.setDefault')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={!!defaultCardConfirm}
        onCancel={() => setDefaultCardConfirm(null)}
        title={t('paymentModal.title')}
        width={MODAL_WIDTH.standard}
        footer={null}
        closable
        destroyOnClose
      >
        <p
          style={{
            fontSize: 14,
            color: 'var(--color-text-muted)',
            fontFamily: 'Poppins, sans-serif',
            margin: '4px 0 0',
            lineHeight: 1.6,
          }}
        >
          {t('paymentModal.setDefaultConfirm', {
            last4:
              paymentMethods.find((p) => p.paymentMethodId === defaultCardConfirm)?.last4 ?? '····',
            name: minglerName,
          })}
        </p>
        <div className="app-modal-footer">
          <SecondaryActionButton onClick={() => setDefaultCardConfirm(null)}>
            Cancel
          </SecondaryActionButton>
          <PrimaryActionButton
            onClick={handleConfirmSetDefault}
            disabled={setDefaultMutation.isPending}
          >
            <Check size={14} weight="bold" />
            {t('paymentModal.confirm')}
          </PrimaryActionButton>
        </div>
      </Modal>
    </>
  )
}
