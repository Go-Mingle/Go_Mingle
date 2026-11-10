import { useState, useMemo } from 'react'
import { withFixedEnds } from '../../molecules/withFixedEnds'
import { useNavigate } from 'react-router-dom'
import { Table, Select, Pagination, Grid, Spin, Alert, message } from 'antd'
import type { TableProps } from 'antd/es/table'
import { DownloadSimple, ShieldCheck } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { Dayjs } from 'dayjs'
import type { FinanceRecord } from './components/financeTypes'
import type { FinancePeriod, FinanceSearchTerms, ListFinancesQueryParams } from './types'
import { TransactionDetailModal } from './components/TransactionDetailModal'
import { buildFinanceColumns } from './components/FinanceTableColumns'
import { FinancesCardList } from './components/FinancesCardList'
import { FinancePeriodDropdown } from './components/FinancePeriodDropdown'
import { FinancesEmptyState } from './components/FinancesEmptyState'
import { FinancesNoResults } from './components/FinancesNoResults'
import { computeDateRangeForPeriod } from './components/financePeriodRange'
import { useFinancesQuery } from './hooks/useFinancesQuery'
import { financesService } from './services'
import {
  FINANCES_DEFAULT_PERIOD,
  FINANCES_PAGE_SIZE,
  FINANCES_PAGE_SIZE_OPTIONS,
  FINANCE_SEARCH_FIELD_BY_COLUMN_KEY,
  FINANCE_SEARCH_FIELDS,
  FINANCE_SORT_FIELD_BY_COLUMN_KEY,
} from './constants'
import { AppButton } from '../../atoms/AppButton'
import { downloadFileFromUrl } from '../../../shared/utils/downloadFile'
import { getApiErrorMessage } from '../../../shared/utils/apiError'

const INITIAL_QUERY_PARAMS: ListFinancesQueryParams = { page: 1, pageSize: FINANCES_PAGE_SIZE }

export function FinancesPage() {
  const { t } = useTranslation('finances')
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [queryParams, setQueryParams] = useState<ListFinancesQueryParams>(INITIAL_QUERY_PARAMS)
  const [detailRecord, setDetailRecord] = useState<FinanceRecord | null>(null)
  const [period, setPeriod] = useState<FinancePeriod>(FINANCES_DEFAULT_PERIOD)

  const { data, isPending, isError } = useFinancesQuery(queryParams)
  const records = data?.items ?? []
  const total = data?.pagination.totalRecords ?? 0
  const currentPage = queryParams.page ?? 1
  const pageSize = queryParams.pageSize ?? FINANCES_PAGE_SIZE
  const startRecord = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, total)

  // Two kinds of narrowing, and they need different zero-result treatments.
  // `page`/`pageSize` are defaults, not filters, and sort cannot empty a result
  // set, so neither counts here.
  const hasSearchTerms = FINANCE_SEARCH_FIELDS.some((field) => !!queryParams[field])
  const hasDateFilter = !!queryParams.dateFrom || !!queryParams.dateTo

  // MET-1301 — the full-page empty state is the designed treatment for a
  // period-narrowed zero result too, not just for "nothing exists at all": the
  // period dropdown lives in the page header, so it stays reachable when the
  // table is replaced and the user can always widen back to All Time.
  //
  // A column filter is different — those controls live in the table header, so
  // replacing the table would strand the user with a filter applied and nothing
  // to clear it with (MET-753's dead end). Those cases keep the table and explain
  // themselves through its own empty body instead.
  //
  // MET-1301 (QA reopen) — the Date column filter belongs to the second group,
  // not the first, and used to be lumped in with period presets because only the
  // resulting bounds were inspected, never their origin. Applying it with no
  // matches replaced the table (unmounting the Date filter itself) while the
  // period dropdown still read "All Time" — and Antd's Select fires no onChange
  // when the current value is re-picked, so nothing could clear the range and the
  // page stayed empty until a reload. Compare the bounds against the range the
  // selected period implies to tell the two origins apart.
  const periodRange = computeDateRangeForPeriod(period)
  const isPeriodDateRange =
    queryParams.dateFrom === periodRange.dateFrom && queryParams.dateTo === periodRange.dateTo
  const hasColumnDateFilter = hasDateFilter && !isPeriodDateRange

  const hasHeaderFilters = hasSearchTerms || hasColumnDateFilter
  const showFullEmptyState = total === 0 && !hasHeaderFilters
  const showNoResults = total === 0 && hasHeaderFilters

  const handleTableChange: TableProps<FinanceRecord>['onChange'] = (_, filters, sorter) => {
    const activeSort = Array.isArray(sorter) ? sorter[0] : sorter
    const sortColumnKey = activeSort?.order
      ? String(activeSort.columnKey ?? activeSort.field ?? '')
      : undefined
    const sortBy = sortColumnKey ? FINANCE_SORT_FIELD_BY_COLUMN_KEY[sortColumnKey] : undefined
    const sortOrder =
      activeSort?.order === 'ascend' ? 'asc' : activeSort?.order === 'descend' ? 'desc' : undefined

    // MET-753 — this used to assign a single `q`/`searchField` pair and `break` on
    // the first column that held a value, so a second active filter (e.g. Restaurant
    // on top of Booking ID) was discarded. The params then matched the previous
    // state, the query key never changed, and no request fired at all. CR-62 gives
    // each column its own AND-combined parameter, so collect every active term.
    const searchTerms: FinanceSearchTerms = {}
    for (const [columnKey, field] of Object.entries(FINANCE_SEARCH_FIELD_BY_COLUMN_KEY)) {
      const value = filters?.[columnKey]?.[0]
      const term = value == null ? '' : String(value).trim()
      // Always assign, so clearing a filter overwrites the previous term with
      // undefined instead of leaving it stuck in the query params.
      searchTerms[field] = term || undefined
    }

    let dateFrom: string | undefined
    let dateTo: string | undefined
    const dateRange = filters?.date?.[0] as unknown as [Dayjs, Dayjs] | undefined
    if (Array.isArray(dateRange) && dateRange[0] && dateRange[1]) {
      dateFrom = dateRange[0].format('YYYY-MM-DD')
      dateTo = dateRange[1].format('YYYY-MM-DD')
    }

    setQueryParams((prev) => ({
      ...prev,
      ...searchTerms,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
      page: 1,
    }))
  }

  const columns = useMemo(
    () =>
      buildFinanceColumns(
        queryParams,
        (record) => setDetailRecord(record),
        (record) => {
          if (record.minglerId) navigate(`/minglers/${record.minglerId}`)
        },
        (record) => {
          if (record.restaurantId) navigate(`/restaurants/${record.restaurantId}`)
        },
      ),
    [queryParams, navigate],
  )

  // Escape hatch offered by `FinancesNoResults`. Resets the search terms and
  // date bounds but keeps the chosen page size.
  const handleClearFilters = () => {
    setPeriod(FINANCES_DEFAULT_PERIOD)
    setQueryParams((prev) => ({
      page: 1,
      pageSize: prev.pageSize,
      sortBy: prev.sortBy,
      sortOrder: prev.sortOrder,
    }))
  }

  const handlePeriodChange = (newPeriod: FinancePeriod) => {
    setPeriod(newPeriod)
    const { dateFrom, dateTo } = computeDateRangeForPeriod(newPeriod)
    setQueryParams((prev) => ({ ...prev, dateFrom, dateTo, page: 1 }))
  }

  const handleExportCsv = async () => {
    try {
      // MET-1308 — the CSV must honour the active period/search/sort, so the
      // export goes out with the same params the grid is querying with.
      const { url } = await financesService.exportCsv(queryParams)
      const filename = url.split('?')[0]?.split('/').pop() || 'finances.csv'
      await downloadFileFromUrl(url, filename)
    } catch (err) {
      void message.error(getApiErrorMessage(err, t('common:errors.genericError')))
    }
  }

  if (isPending) return <Spin className="flex justify-center mt-20" />
  if (isError) return <Alert type="error" message={t('common:errors.fetchError')} className="m-4" />

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 min-h-9 ${isMobile ? 'mb-4' : 'mb-6'}`}
      >
        <h1
          className={`m-0 ${isMobile ? 'text-xl' : 'text-[26px]'} font-bold text-(--color-text) [font-family:var(--font-ui)] leading-tight inline-flex items-center`}
        >
          {t('title')}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <AppButton variant="primary" onClick={() => navigate('/finances/escrow')}>
            <ShieldCheck size={15} weight="regular" />
            {t('escrowButton')}
          </AppButton>
          <FinancePeriodDropdown value={period} onChange={handlePeriodChange} />
          <AppButton variant="neutral" onClick={handleExportCsv}>
            <DownloadSimple size={15} weight="regular" />
            {t('export')}
          </AppButton>
        </div>
      </div>

      {showFullEmptyState ? (
        <FinancesEmptyState dateFiltered={hasDateFilter} />
      ) : /* The card list has no empty body to render a message into, and a
             filter set on a wider viewport survives the resize into it. */
      isMobile && showNoResults ? (
        <FinancesNoResults onClearFilters={handleClearFilters} />
      ) : isMobile ? (
        <>
          <FinancesCardList
            data={records}
            onView={(record) => setDetailRecord(record)}
            onMinglerClick={(record) => {
              if (record.minglerId) navigate(`/minglers/${record.minglerId}`)
            }}
          />

          <div className="flex justify-center pt-4">
            <Pagination
              current={currentPage}
              total={total}
              pageSize={pageSize}
              onChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
              showSizeChanger={false}
              size="small"
            />
          </div>
        </>
      ) : (
        <>
          <div className="finances-table">
            <Table<FinanceRecord>
              dataSource={records}
              columns={withFixedEnds(columns)}
              rowKey="id"
              size="middle"
              pagination={false}
              scroll={{ x: 'max-content' }}
              onChange={handleTableChange}
              // MET-1301 — without this the table body fell back to Ant Design's
              // generic "No data" placeholder, which says nothing about *why* the
              // grid is empty. The table only ever renders with zero rows when a
              // header filter — a column search term or the Date column filter —
              // excluded everything (see `showFullEmptyState` above), so name that
              // case and offer a way to clear it.
              locale={{
                emptyText: <FinancesNoResults onClearFilters={handleClearFilters} />,
              }}
              onRow={(record) => ({
                onClick: () => setDetailRecord(record),
                style: { cursor: 'pointer' },
              })}
            />
          </div>

          {/* Pagination row — nothing to page through on a zero-row result, and
              "Showing 0–0 of 0 results" is noise under the no-results message. */}
          {total > 0 && (
            <div className="flex flex-row flex-nowrap items-center justify-end gap-3 pt-3">
              <span className="text-[13px] text-(--color-text-muted) whitespace-nowrap shrink-0">
                {t('pagination.showing', {
                  start: startRecord,
                  end: endRecord,
                  total: total.toLocaleString(),
                })}
              </span>
              <span className="shrink-0 leading-none">
                <div className="finances-pagination">
                  <Pagination
                    current={currentPage}
                    total={total}
                    pageSize={pageSize}
                    onChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
                    showSizeChanger={false}
                    size="small"
                  />
                </div>
              </span>
              <Select
                value={pageSize}
                onChange={(val) => setQueryParams((prev) => ({ ...prev, pageSize: val, page: 1 }))}
                className="w-25 shrink-0"
                size="small"
                options={FINANCES_PAGE_SIZE_OPTIONS.map((v) => ({ value: v, label: `${v} / page` }))}
              />
            </div>
          )}
        </>
      )}

      <TransactionDetailModal
        bookingId={detailRecord?.bookingId ?? null}
        onClose={() => setDetailRecord(null)}
      />
    </div>
  )
}
