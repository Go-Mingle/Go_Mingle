import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { XCircle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { BulkActionBar } from '../../../molecules/BulkActionBar'
import { BulkActionModal } from '../../../molecules/BulkActionModal'
import { ExportCsvButton } from '../../../molecules/ExportCsvButton'
import { adminBookingsService } from '../../minglers/services'
import type { InterestTableBooking } from '../types'

/**
 * Cancel several bookings of one interest table at once (GM-345). Each
 * cancellation releases its card holds and refunds the Mingler, as a single
 * cancel does.
 */
export function InterestTableBookingsBulk({
  selected,
  onClear,
  onFinished,
}: {
  bookings: InterestTableBooking[]
  selected: InterestTableBooking[]
  onClear: () => void
  onFinished: (doneIds: string[]) => void
}) {
  const { t } = useTranslation(['interest-tables', 'common'])
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const items = selected.map((b) => ({ id: b.id, name: `${b.guest} · ${b.bookingId}` }))

  return (
    <>
      <BulkActionBar
        count={selected.length}
        onClear={onClear}
        actions={[
          {
            key: 'cancel',
            label: t('interest-tables:bulk.cancel', { count: selected.length }),
            icon: <XCircle size={14} aria-hidden />,
            variant: 'danger',
            onClick: () => setOpen(true),
          },
        ]}
      />
      {open && (
        <BulkActionModal
          open
          title={t('interest-tables:bulk.cancelTitle', { count: items.length })}
          description={t('interest-tables:bulk.cancelBody', { count: items.length })}
          confirmLabel={t('interest-tables:bulk.cancel', { count: items.length })}
          danger
          items={items}
          task={(item) => adminBookingsService.cancel(item.id)}
          onClose={() => setOpen(false)}
          onFinished={(done) => {
            void qc.invalidateQueries({ queryKey: ['bookings'] })
            void qc.invalidateQueries({ queryKey: ['interest-table'] })
            void qc.invalidateQueries({ queryKey: ['interest-tables'] })
            onFinished(done)
          }}
        />
      )}
    </>
  )
}

/** The table's bookings as CSV (a table holds at most a few, all already loaded). */
export function BookingsExportButton({ bookings }: { bookings: InterestTableBooking[] }) {
  const { t } = useTranslation('interest-tables')
  const tableName = bookings[0]?.interestTableTopic ?? 'interest-table'
  return (
    <ExportCsvButton
      fileBase={`bookings-${tableName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}`}
      columns={[
        { key: 'bookingId', header: t('bulk.export.reference') },
        { key: 'guest', header: t('bulk.export.guest') },
        { key: 'date', header: t('bulk.export.date') },
        { key: 'comboName', header: t('bulk.export.menu') },
        { key: 'seats', header: t('bulk.export.seats') },
        { key: 'status', header: t('bulk.export.status') },
        { key: 'bill', header: t('bulk.export.bill') },
      ]}
      load={async () => ({ rows: bookings })}
    />
  )
}
