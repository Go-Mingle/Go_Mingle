import { Alert, Grid, Spin, Table, Tooltip } from 'antd'
import { Receipt, UserMinus, X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { ColumnsType } from 'antd/es/table'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import { StatusBadge } from '../../../../atoms/StatusBadge'
import { CardDetailRow, RESPONSIVE_CARD_CLASS } from '../../../../molecules/CardDetailRow'
import { ProminglerBadge } from '../../../../molecules/ProminglerBadge'
import { pinEndColumns } from '../../../../molecules/tableColumns'
import { TabEmptyState } from '../../components/TabEmptyState'
import { bookingStatusVariant, displayBill, displayDate, prominglerBadge } from '../format'
import type { InterestTableDetailController } from '../hooks/useInterestTableDetail'
import type { InterestTableBookingRow } from '../types'

const EM_DASH = '—'

/** How the booking turned out, once it is checked in; the penalty collected, if any. */
function AttendanceCell({ row }: { row: InterestTableBookingRow }) {
  const { t } = useTranslation('restaurants')
  if (!row.attendance) return <span className="text-[13px] text-[var(--color-text-muted)]">{EM_DASH}</span>
  return (
    <span className="flex flex-col text-[13px]">
      <span className="whitespace-nowrap text-[var(--color-text-secondary)]">
        {t(`partnerInterestTables.attendance.${row.attendance}`, { empty: row.emptySeats ?? 0, seats: row.seats ?? 0 })}
      </span>
      {row.penaltyStatus === 'FAILED' ? (
        <span className="whitespace-nowrap text-[12px] text-[var(--color-error)]">{t('partnerInterestTables.penaltyFailed')}</span>
      ) : (
        typeof row.penaltyChargedPkr === 'number' &&
        row.penaltyChargedPkr > 0 && (
          <span className="whitespace-nowrap text-[12px] text-[var(--color-text-muted)]">
            {t('partnerInterestTables.penaltyCharged', { amount: displayBill(row.penaltyChargedPkr) })}
          </span>
        )
      )}
    </span>
  )
}

/** Offered strictly from the row's own `canMarkNoShow`, behind the same ACTIVE-only gate as the ×. */
function NoShowButton({ c, row }: { c: InterestTableDetailController; row: InterestTableBookingRow }) {
  const { t } = useTranslation('restaurants')
  if (!c.canCancel || !row.canMarkNoShow) return null
  return (
    <button
      type="button"
      onClick={() => c.requestNoShow(row)}
      aria-label={t('partnerInterestTables.noShowAction', { name: row.minglerName })}
      className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border-none bg-transparent px-2 py-1 text-[13px] font-medium text-[var(--color-error)] md:hover:bg-[var(--color-error-bg)]"
    >
      <UserMinus size={15} />
      {t('partnerInterestTables.noShow')}
    </button>
  )
}

/**
 * The Bookings tab (US-03).
 *
 * The × is rendered strictly from the row's own `cancellable` flag, gated by the
 * ACTIVE-only rule (BR-07). It is **never** recomputed from the status: the server's
 * rule is stricter — it also excludes Promingler bookings and some charge-retry
 * states — so deriving it here would put buttons on rows that 409.
 */
export function BookingsTab({ c }: { c: InterestTableDetailController }) {
  const { t } = useTranslation(['restaurants', 'common'])
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  if (c.bookingsPending) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    )
  }

  if (c.bookingsError) {
    return (
      <Alert
        type="error"
        message={getApiErrorMessage(c.bookingsErrorCause, t('common:errors.fetchError'))}
      />
    )
  }

  if (c.bookings.length === 0) {
    return (
      <TabEmptyState
        IconComp={Receipt}
        title={t('restaurants:partnerInterestTables.bookingsEmptyTitle')}
        description={t('restaurants:partnerInterestTables.bookingsEmptyDesc')}
      />
    )
  }

  if (isMobile) {
    return <BookingsMobileList c={c} />
  }

  return (
    <Table<InterestTableBookingRow>
      rowKey="bookingId"
      dataSource={c.bookings}
      columns={pinEndColumns(buildBookingsColumns({ t, c }))}
      pagination={false}
      size="middle"
      scroll={{ x: 'max-content' }}
      className="detail-bookings-table"
    />
  )
}

function buildBookingsColumns({
  t,
  c,
}: {
  t: ReturnType<typeof useTranslation>['t']
  c: InterestTableDetailController
}): ColumnsType<InterestTableBookingRow> {
  const canCancelAny = c.canCancel

  return [
    {
      title: t('restaurants:partnerInterestTables.bookingCols.mingler'),
      key: 'mingler',
      render: (_value, row) => (
        <MinglerNameCell row={row} onOpen={() => c.openMingler(row.minglerId)} />
      ),
    },
    {
      title: t('restaurants:partnerInterestTables.bookingCols.menuOption'),
      dataIndex: 'menuOption',
      key: 'menuOption',
      render: (value: string) => (
        <span className="text-[13px] text-[var(--color-text-secondary)]">{value}</span>
      ),
    },
    {
      title: t('restaurants:partnerInterestTables.bookingCols.seats'),
      dataIndex: 'seats',
      key: 'seats',
      render: (value: number | undefined) => (
        <span className="text-[13px] text-[var(--color-text-secondary)]">{value ?? EM_DASH}</span>
      ),
    },
    {
      title: t('restaurants:partnerInterestTables.bookingCols.date'),
      dataIndex: 'date',
      key: 'date',
      render: (value: string) => (
        <span className="whitespace-nowrap text-[13px] text-[var(--color-text-secondary)]">
          {displayDate(value)}
        </span>
      ),
    },
    {
      title: t('restaurants:partnerInterestTables.bookingCols.bill'),
      dataIndex: 'billPkr',
      key: 'billPkr',
      render: (_value, row) => (
        <span className="whitespace-nowrap text-[13px] text-[var(--color-text-secondary)]">
          {displayBill(row.billPkr)}
        </span>
      ),
    },
    {
      title: t('restaurants:partnerInterestTables.bookingCols.status'),
      dataIndex: 'status',
      key: 'status',
      render: (_value, row) => <StatusBadge variant={bookingStatusVariant(row.status)} />,
    },
    {
      title: t('restaurants:partnerInterestTables.bookingCols.attendance'),
      key: 'attendance',
      render: (_value, row) => <AttendanceCell row={row} />,
    },
    {
      title: '',
      key: 'noShow',
      align: 'center' as const,
      render: (_value, row) => <NoShowButton c={c} row={row} />,
    },
    {
      title: '',
      key: 'view',
      align: 'center' as const,
      render: (_value, row) => (
        <button
          type="button"
          onClick={() => c.openBooking(row.bookingId)}
          aria-label={t('restaurants:partnerInterestTables.viewBooking', { ref: row.bookingRef })}
          className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-medium text-[var(--color-accent)] hover:underline"
        >
          {t('restaurants:partnerInterestTables.viewDetails')}
        </button>
      ),
    },
    // Absent entirely while the restaurant is not ACTIVE (BR-07), rather than
    // rendered disabled.
    ...(canCancelAny
      ? [
          {
            title: '',
            key: 'cancel',
            align: 'center' as const,
            render: (_value: unknown, row: InterestTableBookingRow) =>
              row.cancellable ? (
                <button
                  type="button"
                  onClick={() => c.requestCancelBooking(row)}
                  aria-label={t('restaurants:partnerInterestTables.cancelBookingAction', {
                    name: row.minglerName,
                  })}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-[var(--color-text-muted)] md:hover:bg-[var(--color-error-bg)] md:hover:text-[var(--color-error)]"
                >
                  <X size={16} />
                </button>
              ) : null,
          },
        ]
      : []),
  ]
}

/** The Mingler name opens the profile modal (BR-10). */
function MinglerNameCell({ row, onOpen }: { row: InterestTableBookingRow; onOpen: () => void }) {
  const badge = prominglerBadge(row.proMingler.kind)

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <button
        type="button"
        onClick={onOpen}
        className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)] hover:underline"
      >
        {row.minglerName}
      </button>
      {badge.show && <ProminglerBadge verified={badge.verified} label={false} />}
    </span>
  )
}

function BookingsMobileList({ c }: { c: InterestTableDetailController }) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <div className="detail-bookings-card-list">
      {c.bookings.map((row) => (
        <div key={row.bookingId} className={RESPONSIVE_CARD_CLASS}>
          <div className="flex items-start justify-between gap-3">
            <MinglerNameCell row={row} onOpen={() => c.openMingler(row.minglerId)} />
            <StatusBadge variant={bookingStatusVariant(row.status)} />
          </div>

          <CardDetailRow
            label={t('restaurants:partnerInterestTables.bookingCols.menuOption')}
            value={row.menuOption}
          />
          <CardDetailRow
            label={t('restaurants:partnerInterestTables.bookingCols.date')}
            value={displayDate(row.date)}
          />
          <CardDetailRow
            label={t('restaurants:partnerInterestTables.bookingCols.bill')}
            value={displayBill(row.billPkr)}
          />
          <CardDetailRow
            label={t('restaurants:partnerInterestTables.bookingCols.seats')}
            value={row.seats ?? EM_DASH}
          />
          {row.attendance && (
            <CardDetailRow
              label={t('restaurants:partnerInterestTables.bookingCols.attendance')}
              value={<AttendanceCell row={row} />}
            />
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => c.openBooking(row.bookingId)}
              className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-medium text-[var(--color-accent)]"
            >
              {t('restaurants:partnerInterestTables.viewDetails')}
            </button>
            <NoShowButton c={c} row={row} />
            {c.canCancel && row.cancellable && (
              <Tooltip title={t('restaurants:partnerInterestTables.cancelBooking')}>
                <button
                  type="button"
                  onClick={() => c.requestCancelBooking(row)}
                  aria-label={t('restaurants:partnerInterestTables.cancelBookingAction', {
                    name: row.minglerName,
                  })}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-[var(--color-error)]"
                >
                  <X size={16} />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
