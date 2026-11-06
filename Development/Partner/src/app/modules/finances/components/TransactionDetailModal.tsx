import { Alert, Modal, Spin } from 'antd'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import { formatPkr, formatLedgerDate, formatLoyaltyDeduction } from '../financesFormat'
import type { FinanceTransactionDetail } from '../types'
import { DetailRow } from './DetailRow'

interface TransactionDetailModalProps {
  open: boolean
  detail?: FinanceTransactionDetail
  loading: boolean
  error: unknown
  onClose: () => void
}

/**
 * Transaction details (US-03) — read-only, close (X) only, no action buttons.
 *
 * The data is fetched rather than taken from the clicked row: the grid carries
 * neither the GoMingle share nor the loyalty pair, and deriving the share from
 * the row's two numbers would be wrong because loyalty is part of the total.
 *
 * Field order is fixed by BR-11: Booking ID, Restaurant, Mingler, Date, My Share,
 * GoMingle Share (teal), Loyalty Deduction, Total Amount (bold).
 */
export function TransactionDetailModal({
  open,
  detail,
  loading,
  error,
  onClose,
}: TransactionDetailModalProps) {
  const { t } = useTranslation(['finances', 'common'])

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('finances:detail.title')}
      width={480}
      closable
      footer={null}
      destroyOnHidden
    >
      {loading && (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      )}

      {!loading && !!error && (
        <Alert
          type="error"
          className="my-2"
          // A 404 here means "no such booking", "another restaurant's booking" or
          // "not completed" — deliberately indistinguishable, so one message.
          message={getApiErrorMessage(error, t('finances:detail.notFound'))}
        />
      )}

      {!loading && !error && detail && (
        <div className="mt-2">
          <DetailRow label={t('finances:detail.bookingId')} value={detail.bookingRef} />
          <DetailRow label={t('finances:detail.restaurant')} value={detail.restaurantName} />
          <DetailRow label={t('finances:detail.mingler')} value={detail.mingler.name} />
          <DetailRow label={t('finances:detail.date')} value={formatLedgerDate(detail.date)} />

          <DetailRow
            label={t('finances:detail.partnerShare')}
            value={formatPkr(detail.mySharePkr)}
          />
          <DetailRow
            label={t('finances:detail.gomingleShare')}
            value={formatPkr(detail.gomingleSharePkr)}
            valueStyle={{ color: 'var(--color-accent-dark)' }}
          />
          {/* Always rendered — an em dash when nothing was redeemed (AC-03.4), and
              a plain positive value when it was, not a red negative. */}
          <DetailRow
            label={t('finances:detail.loyaltyDeduction')}
            value={formatLoyaltyDeduction(
              detail.loyaltyDeductionPkr,
              detail.loyaltyDeductionPoints,
            )}
          />

          <DetailRow
            label={t('finances:detail.totalAmount')}
            noBorder
            value={formatPkr(detail.totalAmountPkr)}
            valueStyle={{ fontWeight: 600, fontSize: 14 }}
          />
        </div>
      )}
    </Modal>
  )
}
