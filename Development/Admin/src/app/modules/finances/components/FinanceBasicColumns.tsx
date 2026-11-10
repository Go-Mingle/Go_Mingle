import type { ColumnType } from 'antd/es/table'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import type { FinanceRecord } from './financeTypes'
import type { ListFinancesQueryParams } from '../types'
import {
  tableSortIcon,
  searchFilterDropdown,
  searchFilterIcon,
  dateRangeFilterDropdown,
  dateFilterIcon,
  searchFilteredValue,
  dateRangeFilteredValue,
  columnSortOrder,
} from './financeFilterHelpers'
import i18n from '../../../../locales/i18n'

dayjs.extend(customParseFormat)

// The list API sends `date` as "DD-MM-YYYY" (e.g. "29-06-2026"), not ISO —
// dayjs must be told the source format or it parses this as Invalid Date.
const API_DATE_FORMAT = 'DD-MM-YYYY'

const textStyle = {
  base: {
    fontFamily: 'Poppins, sans-serif',
    fontSize: 14,
    fontWeight: 500,
  },
}

function buildBasicColumns(
  queryParams: ListFinancesQueryParams,
  onMinglerClick?: (record: FinanceRecord) => void,
) {
  const t = i18n.t.bind(i18n)

  const bookingId: ColumnType<FinanceRecord> = {
    title: t('finances:table.headers.bookingId'),
    dataIndex: 'bookingId',
    key: 'bookingId',
    align: 'left' as const,
    sorter: true,
    sortOrder: columnSortOrder(queryParams, 'bookingRef'),
    sortIcon: tableSortIcon,
    filterDropdown: searchFilterDropdown(t('finances:search.bookingId')),
    filterIcon: searchFilterIcon,
    filteredValue: searchFilteredValue(queryParams, 'bookingRef'),
    render: (val: string) => (
      <span style={{ ...textStyle.base, color: 'var(--color-text-secondary)' }}>{val}</span>
    ),
  }

  const mingler: ColumnType<FinanceRecord> = {
    title: t('finances:table.headers.mingler'),
    dataIndex: 'mingler',
    key: 'mingler',
    align: 'left' as const,
    sorter: true,
    sortOrder: columnSortOrder(queryParams, 'mingler'),
    sortIcon: tableSortIcon,
    filterDropdown: searchFilterDropdown(t('finances:search.mingler')),
    filterIcon: searchFilterIcon,
    filteredValue: searchFilteredValue(queryParams, 'mingler'),
    render: (name: string, record: FinanceRecord) => {
      const clickable = !!onMinglerClick && !!record.minglerId
      return (
        <span
          role={clickable ? 'button' : undefined}
          onClick={
            clickable
              ? (e) => {
                  e.stopPropagation()
                  onMinglerClick(record)
                }
              : undefined
          }
          style={{
            ...textStyle.base,
            color: clickable ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            cursor: clickable ? 'pointer' : 'default',
          }}
          onMouseEnter={(e) => {
            if (clickable) e.currentTarget.style.textDecoration = 'underline'
          }}
          onMouseLeave={(e) => {
            if (clickable) e.currentTarget.style.textDecoration = 'none'
          }}
        >
          {name}
        </span>
      )
    },
  }

  const interestTable: ColumnType<FinanceRecord> = {
    title: t('finances:table.headers.interestTable'),
    dataIndex: 'interestTableTopic',
    key: 'interestTableTopic',
    align: 'left' as const,
    sorter: true,
    sortOrder: columnSortOrder(queryParams, 'interestTable'),
    sortIcon: tableSortIcon,
    filterDropdown: searchFilterDropdown(t('finances:search.interestTable')),
    filterIcon: searchFilterIcon,
    filteredValue: searchFilteredValue(queryParams, 'interestTable'),
    render: (val?: string) => (
      <span style={{ ...textStyle.base, color: 'var(--color-text)' }}>{val ?? '—'}</span>
    ),
  }

  const date: ColumnType<FinanceRecord> = {
    title: t('finances:table.headers.date'),
    dataIndex: 'date',
    key: 'date',
    align: 'left' as const,
    sorter: true,
    sortOrder: columnSortOrder(queryParams, 'date'),
    sortIcon: tableSortIcon,
    filterDropdown: dateRangeFilterDropdown,
    filterIcon: dateFilterIcon,
    filteredValue: dateRangeFilteredValue(queryParams) as unknown as (string | number)[],
    render: (val: string) => (
      <span style={{ ...textStyle.base, color: 'var(--color-text-secondary)' }}>
        {dayjs(val, API_DATE_FORMAT).format('YYYY-MM-DD')}
      </span>
    ),
  }

  // No search filter — the list API exposes no search parameter for total
  // amount (CR-62 covers bookingRef/restaurant/mingler/interestTable only),
  // so this column is sortable only.
  const totalAmount: ColumnType<FinanceRecord> = {
    title: t('finances:table.headers.totalAmount'),
    dataIndex: 'totalAmount',
    key: 'totalAmount',
    align: 'left' as const,
    sorter: true,
    sortOrder: columnSortOrder(queryParams, 'total'),
    sortIcon: tableSortIcon,
    render: (val: number) => (
      <span
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--color-text)',
        }}
      >
        PKR {val.toLocaleString()}
      </span>
    ),
  }

  // Shell columns — no sorter/filter (FinanceSortField excludes them); render '—'
  // until the list endpoint returns partnerSharePkr/gomingleSharePkr.
  const partnerShare: ColumnType<FinanceRecord> = {
    title: t('finances:table.headers.partnerShare'),
    dataIndex: 'partnerShare',
    key: 'partnerShare',
    align: 'left' as const,
    render: (val?: number) => (
      <span style={{ ...textStyle.base, color: 'var(--color-text-secondary)' }}>
        {val != null ? `PKR ${val.toLocaleString()}` : '—'}
      </span>
    ),
  }

  const gomingleShare: ColumnType<FinanceRecord> = {
    title: t('finances:table.headers.gomingleShare'),
    dataIndex: 'gomingleShare',
    key: 'gomingleShare',
    align: 'left' as const,
    render: (val?: number) => (
      <span style={{ ...textStyle.base, color: 'var(--color-text-secondary)' }}>
        {val != null ? `PKR ${val.toLocaleString()}` : '—'}
      </span>
    ),
  }

  return { bookingId, mingler, interestTable, date, totalAmount, partnerShare, gomingleShare }
}

export function buildBasicFinanceColumns(
  queryParams: ListFinancesQueryParams,
  onMinglerClick?: (record: FinanceRecord) => void,
) {
  return buildBasicColumns(queryParams, onMinglerClick)
}
