import { useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { pinEndColumns } from '../../../molecules/tableColumns'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { toListParams } from '../adapters'
import type { UserRow } from './types'
import type { PartnerUsersQueryParams } from '../types'
import {
  tableSortIcon,
  searchFilterDropdown,
  searchFilterIcon,
  dateRangeFilterDropdown,
  dateFilterIcon,
  statusFilterIcon,
  userStatusColours,
} from './tableHelpers'
import { UserActionCell } from './UserActionCell'

interface UsersTableProps {
  data: UserRow[]
  loading?: boolean
  onEdit: (row: UserRow) => void
  onResetPassword: (row: UserRow) => void
  onDelete: (row: UserRow) => void
  /** Sorting, searching and filtering are all resolved server-side. */
  onListParamsChange: (params: PartnerUsersQueryParams) => void
  /**
   * Body shown when there are no rows. The caller owns it because only the page
   * knows whether a filter is applied, and the two cases need different advice
   * (MET-1307). Left unset the table falls back to AntD's bare "No data".
   */
  emptyText?: ReactNode
}

interface UsersColumnHandlers {
  onEdit: (row: UserRow) => void
  onResetPassword: (row: UserRow) => void
  onDelete: (row: UserRow) => void
}

/**
 * Columns carry `sorter: true` and no `onFilter`: the grid is paginated at
 * 25/page, so a client-side comparator would only ever reorder the page in
 * hand and quietly disagree with the row count beneath it. The controls
 * themselves — sort arrows, search dropdowns, the status funnel, the date
 * range — are unchanged; they now emit query params instead.
 *
 * Each affordance is named per column (MET-1247). They all existed and all
 * round-tripped their query param, but every icon was a bare <svg>, so the
 * search, status and date-range controls were unreachable by accessible name
 * and read as absent. See the note in `tableHelpers.tsx`.
 */
function buildUserColumns(
  t: TFunction<['users', 'common']>,
  { onEdit, onResetPassword, onDelete }: UsersColumnHandlers,
): ColumnsType<UserRow> {
  const nameHeader = t('table.headers.name')
  const designationHeader = t('table.headers.designation')
  const lastActiveHeader = t('table.headers.lastActive')
  const statusHeader = t('table.headers.status')

  const buttons = { reset: t('common:buttons.reset'), submit: t('common:buttons.search') }

  return [
    {
      title: nameHeader,
      dataIndex: 'name',
      key: 'name',
      align: 'left',
      sorter: true,
      sortIcon: tableSortIcon(t('table.sortBy', { column: nameHeader })),
      filterDropdown: searchFilterDropdown({
        ...buttons,
        placeholder: t('table.searchName'),
        fieldLabel: t('table.searchBy', { column: nameHeader }),
      }),
      filterIcon: searchFilterIcon(t('table.searchBy', { column: nameHeader })),
      render: (v: string) => (
        <span className="text-[14px] font-medium text-[var(--color-text)] font-[Poppins,sans-serif]">
          {v}
        </span>
      ),
    },
    {
      title: designationHeader,
      dataIndex: 'designation',
      key: 'designation',
      align: 'left',
      sorter: true,
      sortIcon: tableSortIcon(t('table.sortBy', { column: designationHeader })),
      filterDropdown: searchFilterDropdown({
        ...buttons,
        placeholder: t('table.searchDesignation'),
        fieldLabel: t('table.searchBy', { column: designationHeader }),
      }),
      filterIcon: searchFilterIcon(t('table.searchBy', { column: designationHeader })),
      render: (v?: string) => (
        <span
          className={`font-[Poppins,sans-serif] text-[14px] font-medium ${
            v ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-subtle)]'
          }`}
        >
          {v || '—'}
        </span>
      ),
    },
    {
      title: lastActiveHeader,
      dataIndex: 'lastActive',
      key: 'lastActive',
      align: 'left',
      sorter: true,
      sortIcon: tableSortIcon(t('table.sortBy', { column: lastActiveHeader })),
      filterDropdown: dateRangeFilterDropdown({
        reset: t('common:buttons.reset'),
        submit: t('common:buttons.apply'),
        fieldLabel: t('table.filterBy', { column: lastActiveHeader }),
        fromPlaceholder: t('table.lastActiveFrom'),
        toPlaceholder: t('table.lastActiveTo'),
      }),
      filterIcon: dateFilterIcon(t('table.filterBy', { column: lastActiveHeader })),
      // Blank for a user who has never logged in (BR-13).
      render: (v?: string) => (
        <span className="font-[Poppins,sans-serif] text-[14px] font-medium text-[var(--color-text-secondary)]">
          {v ? dayjs(v).format('DD-MM-YYYY') : '—'}
        </span>
      ),
    },
    {
      title: statusHeader,
      dataIndex: 'status',
      key: 'status',
      align: 'left',
      sorter: true,
      sortIcon: tableSortIcon(t('table.sortBy', { column: statusHeader })),
      filters: [
        { text: t('table.filterActive'), value: 'active' },
        { text: t('table.filterSuspended'), value: 'suspended' },
      ],
      filterIcon: statusFilterIcon(t('table.filterBy', { column: statusHeader })),
      render: (v: string) => {
        const colours = userStatusColours[v] ?? { bg: 'var(--color-badge-neutral)' }
        const label = v.charAt(0).toUpperCase() + v.slice(1)
        return (
          <span
            className="inline-flex items-center h-6 px-2.5 rounded-[4px] bg-[var(--status-bg)] text-white text-[12px] font-semibold whitespace-nowrap"
            style={{ '--status-bg': colours.bg } as CSSProperties}
          >
            {label}
          </span>
        )
      },
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      align: 'center',
      render: (_: unknown, row) => (
        <UserActionCell
          canDelete={row.canDelete}
          onEdit={() => onEdit(row)}
          onResetPassword={() => onResetPassword(row)}
          onDelete={() => onDelete(row)}
        />
      ),
    },
  ]
}

export function UsersTable({
  data,
  loading,
  onEdit,
  onResetPassword,
  onDelete,
  onListParamsChange,
  emptyText,
}: UsersTableProps) {
  const { t } = useTranslation(['users', 'common'])

  // Each column now builds four labelled affordances, so rebuilding on every
  // render would remount the dropdowns and drop a half-typed search term.
  const columns = useMemo(
    () => pinEndColumns(buildUserColumns(t, { onEdit, onResetPassword, onDelete })),
    [t, onEdit, onResetPassword, onDelete],
  )

  return (
    <div className="users-table">
      <Table<UserRow>
        dataSource={data}
        columns={columns}
        rowKey="id"
        size="middle"
        loading={loading}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={emptyText ? { emptyText } : undefined}
        onChange={(_pagination, filters, sorter) =>
          onListParamsChange(toListParams(filters, sorter))
        }
      />
    </div>
  )
}
