import { Modal } from 'antd'
import { XCircle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { Booking } from './BookingsTableColumns'
import { formatShortDate } from '../../../../shared/utils/dateHelpers'

const bookingStatusColors: Record<string, string> = {
  pending: '#B06000',
  confirmed: '#1565C0',
  completed: '#1A8A5A',
  cancelled: '#C0392B',
}

const CANCELLABLE = new Set(['pending', 'confirmed'])

interface BookingDetailTabsModalProps {
  open: boolean
  booking: Booking | null
  restaurantName?: string
  onClose: () => void
  onCancelBooking?: (booking: Booking) => void
}

interface DetailRow {
  label: string
  value: React.ReactNode
  isLast?: boolean
}

export function BookingDetailTabsModal({
  open,
  booking,
  restaurantName,
  onClose,
  onCancelBooking,
}: BookingDetailTabsModalProps) {
  const { t } = useTranslation('restaurants')
  const navigate = useNavigate()

  const bookingStatusLabels: Record<string, string> = {
    pending: t('bookings.pending'),
    confirmed: t('bookings.confirmed'),
    completed: t('bookings.completed'),
    cancelled: t('bookings.cancelled'),
  }

  const detailRows: DetailRow[] = booking
    ? [
        { label: t('bookings.headers.bookingId'), value: booking.bookingId ?? booking.id },
        { label: t('bookings.restaurantLabel'), value: restaurantName || '—' },
        {
          label: t('bookings.headers.guest'),
          value: booking.minglerId ? (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation()
                if (booking.minglerId) navigate(`/minglers/${booking.minglerId}`)
              }}
              style={{ color: 'var(--color-accent)', cursor: 'pointer', fontWeight: 500 }}
            >
              {booking.guest}
            </span>
          ) : (
            booking.guest
          ),
        },
        {
          label: t('bookings.headers.interestTable'),
          value: booking.interestTableTopic || '—',
        },
        {
          label: t('bookings.headers.combo'),
          value: booking.comboName || '—',
        },
        { label: t('bookings.headers.date'), value: formatShortDate(booking.date) },
        {
          label: t('bookings.headers.status'),
          value: (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 24,
                padding: '0 10px',
                borderRadius: 4,
                background: bookingStatusColors[booking.status] ?? 'var(--color-text-secondary)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {bookingStatusLabels[booking.status] ?? booking.status}
            </span>
          ),
        },
        {
          label: t('bookings.headers.bill'),
          value: booking.bill > 0 ? `PKR ${booking.bill.toLocaleString()}` : '—',
          isLast: true,
        },
      ]
    : []

  return (
    <Modal
      open={open}
      title={t('bookings.bookingDetail')}
      width={520}
      onCancel={onClose}
      footer={null}
      closable
      destroyOnClose
    >
      {booking && (
        <div style={{ fontFamily: 'Poppins, sans-serif' }}>
          {CANCELLABLE.has(booking.status) && onCancelBooking && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button
                onClick={() => onCancelBooking(booking)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 34,
                  padding: '0 14px',
                  background: 'var(--color-error-bg)',
                  color: 'var(--color-error)',
                  border: '1.5px solid var(--color-error-border)',
                  borderRadius: 12,
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <XCircle size={13} weight="regular" />
                {t('bookings.cancelAction')}
              </button>
            </div>
          )}
          {detailRows.map(({ label, value, isLast }) => (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: isLast ? 'none' : '1px solid var(--color-divider)',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500 }}>
                {label}
              </span>
              <span style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500 }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
