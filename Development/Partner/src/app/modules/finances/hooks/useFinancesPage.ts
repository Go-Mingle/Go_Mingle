import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { message } from 'antd'
import { useTranslation } from 'react-i18next'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import type { Dayjs } from 'dayjs'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import { saveFileDownload } from '../../../../shared/utils/fileDownload'
import { FINANCES_DEFAULT_PAGE_SIZE, FINANCES_DEFAULT_PERIOD } from '../constants'
import { hasNarrowingFilters, sanitiseLedgerParams } from '../financesParams'
import type {
  FinanceLedgerRow,
  FinancesLedgerParams,
  FinancesPeriod,
  FinancesSearchField,
  FinancesSortBy,
} from '../types'
import {
  useFinanceDetailQuery,
  useFinancesExportMutation,
  useFinancesLedgerQuery,
} from './useFinancesLedger'

/** AntD column keys → the API's `sortBy` vocabulary. */
const SORT_KEYS: Record<string, FinancesSortBy> = {
  bookingRef: 'bookingRef',
  mingler: 'mingler',
  interestTable: 'interestTable',
  date: 'date',
}

const SEARCH_KEYS: Record<string, FinancesSearchField> = {
  bookingRef: 'bookingRef',
  mingler: 'mingler',
  interestTable: 'interestTable',
}

function firstString(value: FilterValue | null | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value
  return typeof candidate === 'string' && candidate.trim() ? candidate : undefined
}

/** The Date column's calendar hands back a `[from, to]` pair. */
function dateRange(value: FilterValue | null | undefined) {
  const range = (Array.isArray(value) ? value[0] : value) as
    | [Dayjs | null, Dayjs | null]
    | undefined
  if (!Array.isArray(range) || !range[0] || !range[1]) return undefined
  return {
    dateFrom: range[0].format('YYYY-MM-DD'),
    dateTo: range[1].format('YYYY-MM-DD'),
  }
}

/**
 * UI controller for the Finances ledger.
 *
 * Filter state lives in the URL so it survives the trip out to a Mingler or an
 * interest table and back (AC-04.3). That makes the params untrusted input — a
 * stale link could carry a value these endpoints reject with a 422, unlike the
 * J3/J4 grids which silently default — so everything is read back through
 * {@link sanitiseLedgerParams}.
 */
export function useFinancesPage() {
  const { t } = useTranslation(['finances', 'common'])
  const [messageApi, contextHolder] = message.useMessage()
  const [searchParams, setSearchParams] = useSearchParams()

  const [detailBookingId, setDetailBookingId] = useState<string | null>(null)
  const [minglerModalId, setMinglerModalId] = useState<string | null>(null)

  const params = useMemo<FinancesLedgerParams>(
    () =>
      sanitiseLedgerParams({
        page: searchParams.get('page') ?? undefined,
        pageSize: searchParams.get('pageSize') ?? undefined,
        sortBy: searchParams.get('sortBy') ?? undefined,
        sortOrder: searchParams.get('sortOrder') ?? undefined,
        searchField: searchParams.get('searchField') ?? undefined,
        search: searchParams.get('search') ?? undefined,
        period: searchParams.get('period') ?? undefined,
        dateFrom: searchParams.get('dateFrom') ?? undefined,
        dateTo: searchParams.get('dateTo') ?? undefined,
      }),
    [searchParams],
  )

  const ledger = useFinancesLedgerQuery(params)
  const detail = useFinanceDetailQuery(detailBookingId)
  const exportCsv = useFinancesExportMutation()

  const showError = useCallback(
    (cause: unknown) => {
      void messageApi.error(getApiErrorMessage(cause, t('common:errors.genericError')))
    },
    [messageApi, t],
  )

  /** Writes sanitised params back to the URL, dropping anything unset. */
  const applyParams = useCallback(
    (next: FinancesLedgerParams) => {
      const clean = sanitiseLedgerParams(next as Record<string, unknown>)
      const search = new URLSearchParams()
      Object.entries(clean).forEach(([key, value]) => {
        if (value !== undefined) search.set(key, String(value))
      })
      setSearchParams(search, { replace: true })
    },
    [setSearchParams],
  )

  const period: FinancesPeriod = params.dateFrom
    ? 'CUSTOM'
    : (params.period ?? FINANCES_DEFAULT_PERIOD)
  const pageSize = params.pageSize ?? FINANCES_DEFAULT_PAGE_SIZE
  const page = params.page ?? 1

  /** A preset replaces any custom range — the two shapes are mutually exclusive. */
  const selectPeriod = (next: FinancesPeriod) => {
    const { dateFrom: _from, dateTo: _to, ...rest } = params
    void _from
    void _to
    applyParams({ ...rest, period: next, page: 1 })
  }

  const setPage = (next: number) => applyParams({ ...params, page: next })

  const setPageSize = (next: number) => applyParams({ ...params, pageSize: next, page: 1 })

  /**
   * Sorting, per-column search and the Date calendar all arrive through AntD's
   * `onChange`. A date range clears `period`, since sending both is a 422.
   */
  const handleTableChange = (
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<FinanceLedgerRow> | SorterResult<FinanceLedgerRow>[],
  ) => {
    const active = Array.isArray(sorter) ? sorter[0] : sorter
    const sortBy = SORT_KEYS[String(active?.columnKey ?? '')]

    const next: FinancesLedgerParams = { page: 1, pageSize: params.pageSize }

    if (sortBy && active?.order) {
      next.sortBy = sortBy
      next.sortOrder = active.order === 'ascend' ? 'asc' : 'desc'
    }

    // Only one search box is ever active; the first column that carries a value
    // wins, and omitting the field would make the term a no-op server-side.
    for (const [columnKey, field] of Object.entries(SEARCH_KEYS)) {
      const term = firstString(filters[columnKey])
      if (term) {
        next.searchField = field
        next.search = term
        break
      }
    }

    const range = dateRange(filters.date)
    if (range) {
      next.dateFrom = range.dateFrom
      next.dateTo = range.dateTo
    } else if (params.period) {
      next.period = params.period
    }

    applyParams(next)
  }

  const handleExportCsv = () => {
    exportCsv.mutate(params, {
      onSuccess: (file) => {
        saveFileDownload(file)
        void messageApi.success(t('finances:exportToast'))
      },
      onError: showError,
    })
  }

  const openDetail = (row: FinanceLedgerRow) => setDetailBookingId(row.bookingId)

  return {
    contextHolder,

    // Ledger
    rows: ledger.data?.items ?? [],
    totalRecords: ledger.data?.pagination.totalRecords ?? 0,
    isPending: ledger.isPending,
    isError: ledger.isError,
    error: ledger.error,
    isFetching: ledger.isFetching,
    // Which empty state the page owes the partner when the ledger comes back
    // with no rows (MET-1301). Reads the sanitised params, so a value the API
    // would have rejected never counts as a filter the partner could clear.
    hasFilters: hasNarrowingFilters(params),

    // Filters
    period,
    selectPeriod,
    page,
    setPage,
    pageSize,
    setPageSize,
    handleTableChange,
    activeSort: { sortBy: params.sortBy, sortOrder: params.sortOrder },
    activeSearch: { searchField: params.searchField, search: params.search },
    activeRange:
      params.dateFrom && params.dateTo ? { from: params.dateFrom, to: params.dateTo } : null,

    // Detail modal
    detailBookingId,
    openDetail,
    closeDetail: () => setDetailBookingId(null),
    detail: detail.data,
    detailPending: detail.isPending && !!detailBookingId,
    detailError: detail.isError ? detail.error : null,

    // Export
    handleExportCsv,
    exporting: exportCsv.isPending,

    // Mingler profile modal (PP6)
    minglerModalId,
    openMingler: (row: FinanceLedgerRow) => setMinglerModalId(row.mingler.id),
    closeMingler: () => setMinglerModalId(null),
  }
}
