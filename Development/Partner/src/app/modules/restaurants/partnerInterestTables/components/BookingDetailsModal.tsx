import { Alert, Modal, Spin } from 'antd'
import { useTranslation } from 'react-i18next'
import { MODAL_WIDTH } from '../../../../atoms/modalWidth'
import { StatusBadge } from '../../../../atoms/StatusBadge'
import { bookingStatusVariant, displayBill, displayDate, displayTime } from '../format'
import { useBookingQuery } from '../hooks/usePartnerInterestTablesQueries'
import { DetailRows } from './DetailRows'

/**
 * The Booking Details popup (J6F US-03 / AC-03.6, reused by J6G US-04).
 *
 * Fetched on row click rather than rendered from the row, because the bookings list
 * deliberately omits **Topic** and **Time** — mirroring admin, which does the same.
 *
 * The **Restaurant** row is absent by design (BR-10): the partner is already scoped
 * to one restaurant, so naming it would be noise.
 *
 * Read-only. Cancelling is offered on the row rather than here, so this modal has no
 * destructive action and closes itself if the underlying booking is cancelled while
 * it is open.
 *
 * Takes `{ bookingId, onClose }` and owns its own query, rather than the whole
 * `InterestTableDetailController` it originally received. That coupling made it
 * unusable anywhere else — J6G's Reviews tab opens the same popup from a review row
 * (its `bookingId`), and a reviews controller could never satisfy a thirty-field
 * interest-table type. This is the shape `MinglerProfileModal` already had, so the two
 * reused modals now match.
 */
export function BookingDetailsModal({
  bookingId,
  onClose,
}: {
  bookingId: string | null
  onClose: () => void
}) {
  const { t } = useTranslation(['restaurants', 'common'])
  const label = (name: string) => t(`restaurants:partnerInterestTables.bookingModal.${name}`)

  const { data: booking, isPending, isError } = useBookingQuery(bookingId)

  return (
    <Modal
      open={Boolean(bookingId)}
      onCancel={onClose}
      title={t('restaurants:partnerInterestTables.bookingModal.title')}
      footer={null}
      width={MODAL_WIDTH.large}
      destroyOnHidden
    >
      {isPending && (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      )}

      {isError && <Alert type="error" message={t('common:errors.fetchError')} />}

      {booking && (
        <DetailRows
          rows={[
            { label: label('bookingId'), value: booking.bookingRef },
            { label: label('mingler'), value: booking.minglerName },
            { label: label('interestTable'), value: booking.interestTableName },
            { label: label('topic'), value: booking.topic },
            { label: label('menuOption'), value: booking.menuOption },
            { label: label('date'), value: displayDate(booking.date) },
            { label: label('time'), value: displayTime(booking.time) },
            {
              label: label('status'),
              value: <StatusBadge variant={bookingStatusVariant(booking.status)} />,
            },
            // Null until charged — an em dash, never `PKR 0`.
            { label: label('bill'), value: displayBill(booking.billPkr) },
          ]}
        />
      )}
    </Modal>
  )
}
