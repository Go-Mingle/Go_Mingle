import type { ColumnsType } from 'antd/es/table'
import type { TFunction } from 'i18next'
import { formatPkr, formatLedgerDate } from '../financesFormat'
import type { FinanceLedgerRow, FinancesSortBy, FinancesSortOrder } from '../types'
import {
  searchFilterDropdown,
  searchFilterIcon,
  dateRangeFilterDropdown,
  dateFilterIcon,
  tableSortIcon,
} from './financeFilterHelpers'
import { LedgerLinkCell } from './LedgerLinkCell'

const baseTextClass = 'font-[Poppins,sans-serif] text-sm font-medium'

interface ColumnHandlers {
  onMinglerClick: (row: FinanceLedgerRow) => void
  onInterestTableClick: (row: FinanceLedgerRow) => void
}

export interface ActiveLedgerState {
  sortBy?: FinancesSortBy
  sortOrder?: FinancesSortOrder
  searchField?: string
  search?: string
  range: { from: string; to: string } | null
}

/** AntD wants `ascend`/`descend`; the API speaks `asc`/`desc`. */
function sortOrderFor(key: FinancesSortBy, active: ActiveLedgerState): 'ascend' | 'descend' | null {
  if (active.sortBy !== key) return null
  return active.sortOrder === 'asc' ? 'ascend' : 'descend'
}

function filteredValueFor(key: string, active: ActiveLedgerState): string[] | null {
  return active.searchField === key && active.search ? [active.search] : null
}

/**
 * The six ledger columns, exactly as designed (BR-06/BR-07).
 *
 * Sorting and searching resolve server-side — the grid is paginated, so a client
 * comparator would reorder only the page in hand while disagreeing with the total
 * beneath it. The two money columns carry no sort or search affordance at all:
 * the API rejects both with a 422.
 */
export function buildFinanceColumns(
  t: TFunction,
  { onMinglerClick, onInterestTableClick }: ColumnHandlers,
  active: ActiveLedgerState,
): ColumnsType<FinanceLedgerRow> {
  const plainCell = (value: string) => (
    <span className={`${baseTextClass} text-[var(--color-text-secondary)]`}>{value}</span>
  )

  return [
    {
      title: t('finances:table.headers.bookingId'),
      dataIndex: 'bookingRef',
      key: 'bookingRef',
      align: 'left',
      sorter: true,
      sortOrder: sortOrderFor('bookingRef', active),
      sortIcon: tableSortIcon,
      filterDropdown: searchFilterDropdown(t('finances:search.bookingId')),
      filterIcon: searchFilterIcon,
      filteredValue: filteredValueFor('bookingRef', active),
      render: (value: string) => plainCell(value),
    },
    {
      title: t('finances:table.headers.mingler'),
      dataIndex: ['mingler', 'name'],
      key: 'mingler',
      align: 'left',
      sorter: true,
      sortOrder: sortOrderFor('mingler', active),
      sortIcon: tableSortIcon,
      filterDropdown: searchFilterDropdown(t('finances:search.mingler')),
      filterIcon: searchFilterIcon,
      filteredValue: filteredValueFor('mingler', active),
      render: (_value: string, row: FinanceLedgerRow) => (
        <LedgerLinkCell name={row.mingler.name} onClick={() => onMinglerClick(row)} />
      ),
    },
    {
      title: t('finances:table.headers.interestTable'),
      dataIndex: ['interestTable', 'name'],
      key: 'interestTable',
      align: 'left',
      sorter: true,
      sortOrder: sortOrderFor('interestTable', active),
      sortIcon: tableSortIcon,
      filterDropdown: searchFilterDropdown(t('finances:search.interestTable')),
      filterIcon: searchFilterIcon,
      filteredValue: filteredValueFor('interestTable', active),
      render: (_value: string, row: FinanceLedgerRow) => (
        <LedgerLinkCell name={row.interestTable.name} onClick={() => onInterestTableClick(row)} />
      ),
    },
    {
      title: t('finances:table.headers.date'),
      dataIndex: 'date',
      key: 'date',
      align: 'left',
      sorter: true,
      sortOrder: sortOrderFor('date', active),
      sortIcon: tableSortIcon,
      filterDropdown: dateRangeFilterDropdown,
      filterIcon: dateFilterIcon,
      // Marks the funnel active while a custom range is applied, whichever
      // control set it — the period select and this calendar are one filter.
      filteredValue: active.range ? [active.range.from] : null,
      // Rendered as received: YYYY-MM-DD in Asia/Karachi, not the portal's usual
      // DD-MM-YYYY, so it never goes through a shared date helper (BR-09).
      render: (value: string) => plainCell(formatLedgerDate(value)),
    },
    {
      // Neither sortable nor searchable, by design — sending either is a 422.
      title: t('finances:table.headers.totalAmount'),
      dataIndex: 'totalAmountPkr',
      key: 'totalAmountPkr',
      align: 'left',
      render: (value: number) => plainCell(formatPkr(value)),
    },
    {
      title: t('finances:table.headers.partnerShare'),
      dataIndex: 'mySharePkr',
      key: 'mySharePkr',
      align: 'left',
      render: (value: number) => plainCell(formatPkr(value)),
    },
  ]
}
