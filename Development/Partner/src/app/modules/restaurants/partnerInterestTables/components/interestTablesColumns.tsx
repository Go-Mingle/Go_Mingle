/* eslint-disable react-refresh/only-export-components */
// A columns factory that also defines its own cell components — the same shape as
// `ReviewsTableColumns.tsx`, which carries this disable for the same reason. The rule
// is about HMR granularity, not correctness.
import type { ColumnsType } from 'antd/es/table'
import type { useTranslation } from 'react-i18next'
import { StatusBadge } from '../../../../atoms/StatusBadge'
import { LabelTag } from '../../../../atoms/LabelTag'
import { statusFilterIcon } from '../../../users/components/tableHelpers'
import { VISIBLE_IT_STATUSES } from '../constants'
import { ProminglerCell } from './ProminglerCell'
import {
  displayAvailabilityMode,
  displayDate,
  displaySeats,
  displayTime,
  interestTableStatusVariant,
} from '../format'
import type { InterestTableListItem, InterestTableStatus } from '../types'

type Translate = ReturnType<typeof useTranslation>['t']

interface ColumnParams {
  t: Translate
  /** The active server-side filter, so the control reflects the request. */
  status: InterestTableStatus | undefined
  onRowClick: (interestTableId: string) => void
}

/**
 * The grid's columns, mirroring the admin interest-table grid (BR-01).
 *
 * Two deliberate absences: **no restaurant column** — the partner is already scoped
 * to one restaurant — and **no actions column**, because the partner cannot create,
 * edit or cancel an interest table (BR-02).
 *
 * The status filter is `filterMultiple: false` and drives a **server** request; it
 * is not an AntD `onFilter` comparator over rows already on screen. `DRAFT` is not
 * offered, because a partner never sees a Draft table (BR-03).
 *
 * Its trigger carries a **named** Phosphor funnel (MET-1259). Left to itself AntD
 * renders its own `anticon-filter` glyph named the bare, column-less "filter" — the
 * grid's only filter control announced itself as a decoration, which is why the
 * status filter was reported as absent. The same trap as MET-1247 on Users and
 * MET-1525 on Contacts, so it reuses the helper those fixes introduced rather than
 * growing a fourth private copy of it.
 */
export function buildInterestTablesColumns({
  t,
  status,
  onRowClick,
}: ColumnParams): ColumnsType<InterestTableListItem> {
  return [
    {
      title: t('restaurants:partnerInterestTables.columns.name'),
      dataIndex: 'name',
      key: 'name',
      render: (_value, row) => (
        <button
          type="button"
          onClick={() => onRowClick(row.interestTableId)}
          className="flex items-center gap-3 border-none bg-transparent p-0 text-left cursor-pointer min-w-0"
        >
          <TableThumb name={row.name} imageUrl={row.imageUrl} />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-[var(--color-text)]">
              {row.name}
            </span>
            {row.inviteOnly && (
              <span className="mt-0.5 block">
                <LabelTag>{t('restaurants:partnerInterestTables.inviteOnly')}</LabelTag>
              </span>
            )}
          </span>
        </button>
      ),
    },
    {
      title: t('restaurants:partnerInterestTables.columns.dateTime'),
      key: 'dateTime',
      render: (_value, row) => (
        <span className="whitespace-nowrap text-[13px] text-[var(--color-text-secondary)]">
          {displayDate(row.date)} · {displayTime(row.time)}
        </span>
      ),
    },
    {
      title: t('restaurants:partnerInterestTables.columns.seats'),
      key: 'seats',
      render: (_value, row) => (
        <span className="whitespace-nowrap text-[13px] text-[var(--color-text-secondary)]">
          {displaySeats(row.seatsBooked, row.maxGuests)}
        </span>
      ),
    },
    {
      title: t('restaurants:partnerInterestTables.columns.availability'),
      dataIndex: 'availabilityMode',
      key: 'availabilityMode',
      render: (_value, row) => (
        <span className="whitespace-nowrap text-[13px] text-[var(--color-text-secondary)]">
          {displayAvailabilityMode(row.availabilityMode)}
        </span>
      ),
    },
    {
      title: t('restaurants:partnerInterestTables.columns.proMingler'),
      key: 'proMingler',
      render: (_value, row) => <ProminglerCell proMingler={row.proMingler} />,
    },
    {
      title: t('restaurants:partnerInterestTables.columns.status'),
      dataIndex: 'status',
      key: 'status',
      // Server-side: the value round-trips as a query param, so no `onFilter`.
      filters: VISIBLE_IT_STATUSES.map((value) => ({
        text: t(`restaurants:partnerInterestTables.status.${value}`),
        value,
      })),
      filterMultiple: false,
      filterIcon: statusFilterIcon(
        t('restaurants:partnerInterestTables.filterBy', {
          column: t('restaurants:partnerInterestTables.columns.status'),
        }),
      ),
      filteredValue: status ? [status] : null,
      render: (_value, row) => <StatusBadge variant={interestTableStatusVariant(row.status)} />,
    },
  ]
}

function TableThumb({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (!imageUrl) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-accent-light)] text-[12px] font-bold text-[var(--color-accent)]">
        {name.trim().charAt(0).toUpperCase() || '?'}
      </span>
    )
  }
  return (
    <img
      src={imageUrl}
      alt=""
      className="h-9 w-9 shrink-0 rounded-[8px] object-cover"
      loading="lazy"
    />
  )
}
