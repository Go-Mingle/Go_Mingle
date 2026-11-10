import { useEffect } from 'react'
import { Modal, Spin, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { DetailRow } from './DetailRow'
import { useFinanceDetailQuery } from '../hooks/useFinancesQuery'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'

interface TransactionDetailModalProps {
  bookingId: string | null
  onClose: () => void
}

export function TransactionDetailModal({ bookingId, onClose }: TransactionDetailModalProps) {
  const { t } = useTranslation('finances')
  const { data, isPending, isError, error } = useFinanceDetailQuery(bookingId)

  useEffect(() => {
    if (isError) {
      void message.error(getApiErrorMessage(error, t('common:errors.genericError')))
      onClose()
    }
  }, [isError, error, onClose, t])

  return (
    <Modal
      open={!!bookingId}
      onCancel={onClose}
      title={t('detail.title')}
      width={480}
      closable={true}
      footer={null}
      destroyOnClose
    >
      {isPending && <Spin className="flex justify-center py-8" />}
      {data && (
        <div style={{ marginTop: 8 }}>
          {/* Group 1: Booking info */}
          <DetailRow label={t('detail.bookingId')} value={data.bookingRef} />
          <DetailRow label={t('detail.restaurant')} value={data.restaurant} />
          <DetailRow label={t('detail.mingler')} value={data.mingler} />
          <DetailRow label={t('detail.interestTable')} value={data.interestTableName} />
          <DetailRow
            label={t('detail.date')}
            noBorder
            value={`${data.date} · ${data.eventStart}–${data.eventEnd}`}
          />

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--color-divider)', margin: '4px 0' }} />

          {/* Group 2: Pricing breakdown */}
          <DetailRow
            label={t('detail.partnerShare')}
            value={`PKR ${data.partnerSharePkr.toLocaleString()}`}
          />
          <DetailRow
            label={t('detail.gomingleShare')}
            value={`PKR ${data.gomingleSharePkr.toLocaleString()}`}
            valueStyle={{ color: 'var(--color-accent-dark)' }}
          />
          <DetailRow
            label={t('detail.loyaltyDeduction')}
            value={
              data.loyaltyPkrDeduction != null
                ? `-PKR ${data.loyaltyPkrDeduction.toLocaleString()}`
                : '—'
            }
            valueStyle={
              data.loyaltyPkrDeduction != null && data.loyaltyPkrDeduction > 0
                ? { color: 'var(--color-error)' }
                : {}
            }
          />
          <DetailRow
            label={t('detail.loyaltyRedeemed')}
            noBorder
            value={
              data.loyaltyRedeemedPkr > 0
                ? `-PKR ${data.loyaltyRedeemedPkr} (${data.loyaltyRedeemedPoints} pts)`
                : '—'
            }
            valueStyle={data.loyaltyRedeemedPkr > 0 ? { color: 'var(--color-error)' } : {}}
          />

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--color-divider)', margin: '4px 0' }} />

          {/* Group 3: Total */}
          <DetailRow
            label={t('detail.totalAmount')}
            noBorder
            value={`PKR ${data.totalAmountPkr.toLocaleString()}`}
            valueStyle={{ fontWeight: 600, fontSize: 14 }}
          />
        </div>
      )}
    </Modal>
  )
}
