import type { ReactNode } from 'react'
import { Alert, Grid, Select, Spin, Table } from 'antd'
import { CalendarBlank, Funnel } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import { StatusBadge } from '../../../../atoms/StatusBadge'
import { LabelTag } from '../../../../atoms/LabelTag'
import { CardDetailRow, RESPONSIVE_CARD_CLASS } from '../../../../molecules/CardDetailRow'
import { pinEndColumns } from '../../../../molecules/tableColumns'
import { UsersPagination } from '../../../users/components/UsersPagination'
import { TabEmptyState } from '../../components/TabEmptyState'
import { VISIBLE_IT_STATUSES } from '../constants'
import {
  displayAvailabilityMode,
  displayDate,
  displaySeats,
  displayTime,
  interestTableStatusVariant,
} from '../format'
import { buildInterestTablesColumns } from './interestTablesColumns'
import { ProminglerCell } from './ProminglerCell'
import type { InterestTablesTabController } from '../hooks/useInterestTablesTab'
import type { InterestTableListItem, InterestTableStatus } from '../types'

/**
 * The Interest Tables tab (US-01).
 *
 * A read-only mirror of the admin grid: no create button, no per-row actions, no
 * restaurant column, and no Draft filter chip (BR-01, BR-02, BR-03). Paging and
 * filtering are server-side, so what the pagination reports always matches what the
 * server counted.
 *
 * The status filter has two homes, one per breakpoint: the grid's Status column header
 * on desktop, a Select above the card list on mobile. Both drive the same server-side
 * `status` param.
 *
 * Renders in every profile state including PENDING — only the two cancel actions on
 * the detail view are ACTIVE-only (BR-07).
 */
export function InterestTablesTab({ c }: { c: InterestTablesTabController }) {
  const { t } = useTranslation(['restaurants', 'common'])
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const openDetail = (interestTableId: string) => {
    void navigate(`/interest-tables/${interestTableId}`)
  }

  if (c.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    )
  }

  if (c.isError) {
    return (
      <Alert type="error" message={getApiErrorMessage(c.error, t('common:errors.fetchError'))} />
    )
  }

  const isEmpty = c.items.length === 0

  // An unfiltered empty grid means the restaurant has no interest tables at all, and
  // gets the first-time prompt instead of any control.
  if (isEmpty && !c.status) {
    return (
      <div className="pt-5">
        <TabEmptyState
          IconComp={CalendarBlank}
          title={t('restaurants:partnerInterestTables.emptyTitle')}
          description={t('restaurants:partnerInterestTables.emptyDesc')}
        />
      </div>
    )
  }

  // A filter that matches nothing is a different situation and needs different copy —
  // and it must not take the filter down with the rows. Dropping the grid used to strand
  // the partner on an empty tab whose own copy told them to clear a filter that was no
  // longer on screen; it now rides in as the table's own empty body (MET-1259).
  const noMatch = (
    <TabEmptyState
      IconComp={CalendarBlank}
      title={t('restaurants:partnerInterestTables.noMatchTitle')}
      description={t('restaurants:partnerInterestTables.noMatchDesc')}
      compact
    />
  )

  return (
    <div className="pt-5">
      {/* Mobile only: the desktop grid filters from its Status column header, and
          offering both would be two controls for one piece of state. */}
      {isMobile && <StatusFilterSelect status={c.status} onApply={c.applyStatus} />}

      {isMobile ? (
        <InterestTablesMobileList items={c.items} onOpen={openDetail} noMatch={noMatch} />
      ) : (
        <Table<InterestTableListItem>
          rowKey="interestTableId"
          dataSource={c.items}
          columns={pinEndColumns(
            buildInterestTablesColumns({ t, status: c.status, onRowClick: openDetail }),
          )}
          pagination={false}
          size="middle"
          loading={c.isFetching}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: noMatch }}
          onChange={(_pagination, filters) => c.applyStatus(filters.status)}
          className="interest-tables-table"
        />
      )}

      {!isEmpty && (
        <UsersPagination
          isMobile={isMobile}
          total={c.total}
          currentPage={c.page}
          pageSize={c.pageSize}
          onPageChange={c.changePage}
          onPageSizeChange={c.changePageSize}
        />
      )}
    </div>
  )
}

/**
 * The mobile status filter (MET-1259).
 *
 * The card list has no column headers to hang AntD's filter off, so below `md` the one
 * filter this grid has had no home at all — a partner with 50 tables paged 10 at a time
 * could not narrow them to the one that still needed action. `allowClear` is what puts
 * "all statuses" back; `DRAFT` is absent from the options for the same reason it is
 * absent from the column filter (BR-03).
 */
function StatusFilterSelect({
  status,
  onApply,
}: {
  status: InterestTableStatus | undefined
  onApply: (next: unknown) => void
}) {
  const { t } = useTranslation(['restaurants', 'common'])
  const label = t('restaurants:partnerInterestTables.filterBy', {
    column: t('restaurants:partnerInterestTables.columns.status'),
  })

  return (
    <div className="mb-4">
      <Select<InterestTableStatus | undefined>
        value={status}
        // Only the value — AntD's second `option` argument is noise the controller
        // would have to ignore.
        onChange={(next) => onApply(next)}
        allowClear
        aria-label={label}
        placeholder={t('restaurants:partnerInterestTables.allStatuses')}
        suffixIcon={<Funnel size={14} className="text-[var(--color-text-subtle)]" />}
        className="w-full"
        options={VISIBLE_IT_STATUSES.map((value) => ({
          value,
          label: t(`restaurants:partnerInterestTables.status.${value}`),
        }))}
      />
    </div>
  )
}

/**
 * The `<768px` card list, per the design's table→card rule.
 *
 * AntD's column filter lives in a table header this list does not have, so the status
 * filter is a `StatusFilterSelect` above it instead — and the no-match state renders
 * below that control rather than in place of it.
 */
function InterestTablesMobileList({
  items,
  onOpen,
  noMatch,
}: {
  items: InterestTableListItem[]
  onOpen: (interestTableId: string) => void
  noMatch: ReactNode
}) {
  const { t } = useTranslation(['restaurants', 'common'])

  if (items.length === 0) return noMatch

  return (
    <div className="detail-bookings-card-list">
      {items.map((item) => (
        <button
          key={item.interestTableId}
          type="button"
          onClick={() => onOpen(item.interestTableId)}
          className={`${RESPONSIVE_CARD_CLASS} w-full cursor-pointer border-none text-left`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-[var(--color-text)]">
                {item.name}
              </span>
              {item.inviteOnly && (
                <span className="mt-1 block">
                  <LabelTag>{t('restaurants:partnerInterestTables.inviteOnly')}</LabelTag>
                </span>
              )}
            </div>
            <StatusBadge variant={interestTableStatusVariant(item.status)} />
          </div>

          <CardDetailRow
            label={t('restaurants:partnerInterestTables.columns.dateTime')}
            value={`${displayDate(item.date)} · ${displayTime(item.time)}`}
          />
          <CardDetailRow
            label={t('restaurants:partnerInterestTables.columns.seats')}
            value={displaySeats(item.seatsBooked, item.maxGuests)}
          />
          <CardDetailRow
            label={t('restaurants:partnerInterestTables.columns.availability')}
            value={displayAvailabilityMode(item.availabilityMode)}
          />
          <CardDetailRow
            label={t('restaurants:partnerInterestTables.columns.proMingler')}
            value={<ProminglerCell proMingler={item.proMingler} />}
          />
        </button>
      ))}
    </div>
  )
}
