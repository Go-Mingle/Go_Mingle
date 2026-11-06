import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Table, Select, Pagination, Grid, Spin } from 'antd'
import type { TableProps } from 'antd/es/table'
import { pinEndColumns } from '../../molecules/tableColumns'
import { DownloadSimple, MagnifyingGlass, Receipt } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import { AppButton } from '../../atoms/AppButton'
import { MinglerProfileModal } from '../restaurants/partnerInterestTables/components/MinglerProfileModal'
import { TabEmptyState } from '../restaurants/components/TabEmptyState'
import { CardDetailRow, RESPONSIVE_CARD_CLASS } from '../../molecules/CardDetailRow'
import { FINANCES_PAGE_SIZES, FINANCES_PERIODS } from './constants'
import { formatPkr, formatLedgerDate } from './financesFormat'
import { buildFinanceColumns } from './components/FinanceTableColumns'
import { TransactionDetailModal } from './components/TransactionDetailModal'
import { EscrowPanel } from './components/EscrowPanel'
import { useFinancesPage } from './hooks/useFinancesPage'
import type { FinanceLedgerRow, FinancesPeriod } from './types'

/** `ALL_TIME` → `periods.allTime`, matching the existing i18n block. */
const PERIOD_I18N: Record<FinancesPeriod, string> = {
  ALL_TIME: 'allTime',
  THIS_MONTH: 'thisMonth',
  THIS_YEAR: 'thisYear',
  CUSTOM: 'custom',
}

// ── Header ────────────────────────────────────────────────────
interface FinancesPageHeaderProps {
  period: FinancesPeriod
  onSelectPeriod: (period: FinancesPeriod) => void
  onExportCsv: () => void
  exporting: boolean
}

function FinancesPageHeader({
  period,
  onSelectPeriod,
  onExportCsv,
  exporting,
}: FinancesPageHeaderProps) {
  const { t } = useTranslation(['finances', 'common'])

  // CUSTOM is not offered as a choice — it is what the Date-column calendar
  // produces. It appears in the list only so the control can display it.
  const options = FINANCES_PERIODS.filter((value) => value !== 'CUSTOM' || period === 'CUSTOM').map(
    (value) => ({ value, label: t(`finances:periods.${PERIOD_I18N[value]}`) }),
  )

  return (
    <div className="flex flex-col items-stretch justify-between gap-3 min-h-9 mb-4 md:mb-6 md:flex-row md:items-center">
      <h1 className="m-0 inline-flex items-center text-xl font-bold font-[Poppins,sans-serif] leading-[1.2] text-[var(--color-text)] md:text-[26px]">
        {t('finances:title')}
      </h1>
      <div className="flex w-full shrink-0 items-center gap-2 md:w-auto">
        <div className="finances-period-select flex-1 md:flex-initial">
          <Select
            value={period}
            onChange={onSelectPeriod}
            options={options}
            className="w-full md:w-[160px]"
          />
        </div>
        <AppButton
          variant="neutral"
          onClick={onExportCsv}
          disabled={exporting}
          className="shrink-0 justify-center"
        >
          <DownloadSimple size={15} weight="regular" />
          {exporting ? t('finances:exporting') : t('finances:export')}
        </AppButton>
      </div>
    </div>
  )
}

// ── Mobile cards ──────────────────────────────────────────────
interface FinancesCardsProps {
  rows: FinanceLedgerRow[]
  onOpenDetail: (row: FinanceLedgerRow) => void
  t: TFunction
  /** Shown in place of the cards when a filter matched nothing (MET-1301). */
  noMatch: React.ReactNode
}

function FinancesCards({ rows, onOpenDetail, t, noMatch }: FinancesCardsProps) {
  // The desktop grid says this through the table's own empty body; the card list
  // has no equivalent, and rendering an empty <div> said nothing at all.
  if (rows.length === 0) return <div className="finances-card-list">{noMatch}</div>

  return (
    <div className="finances-card-list flex flex-col gap-3">
      {rows.map((row) => (
        <div
          key={row.bookingId}
          role="button"
          tabIndex={0}
          onClick={() => onOpenDetail(row)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onOpenDetail(row)
            }
          }}
          className={`${RESPONSIVE_CARD_CLASS} cursor-pointer`}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="truncate text-sm font-semibold font-[Poppins,sans-serif] text-[var(--color-text)]">
              {row.bookingRef}
            </span>
            <span className="shrink-0 text-sm font-semibold font-[Poppins,sans-serif] text-[var(--color-text)]">
              {formatPkr(row.totalAmountPkr)}
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            <CardDetailRow label={t('finances:card.mingler')} value={row.mingler.name} />
            <CardDetailRow
              label={t('finances:table.headers.interestTable')}
              value={row.interestTable.name}
            />
            <CardDetailRow label={t('finances:card.date')} value={formatLedgerDate(row.date)} />
            <CardDetailRow
              label={t('finances:table.headers.partnerShare')}
              value={formatPkr(row.mySharePkr)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Pagination row ────────────────────────────────────────────
interface FinancesPaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  showSizeSelector: boolean
  t: TFunction
}

function FinancesPaginationRow({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  showSizeSelector,
  t,
}: FinancesPaginationProps) {
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endRecord = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-row flex-nowrap items-center justify-end gap-3 pt-3">
      {showSizeSelector && (
        <span className="text-[13px] whitespace-nowrap shrink-0 text-[var(--color-text-muted)]">
          {t('finances:pagination.showing', {
            start: startRecord,
            end: endRecord,
            total: total.toLocaleString(),
          })}
        </span>
      )}
      <span className="shrink-0 leading-[0]">
        <div className="finances-pagination">
          <Pagination
            current={page}
            total={total}
            pageSize={pageSize}
            onChange={onPageChange}
            showSizeChanger={false}
            size="small"
          />
        </div>
      </span>
      {showSizeSelector && (
        <Select
          value={pageSize}
          onChange={onPageSizeChange}
          className="w-[100px] shrink-0"
          size="small"
          // 10/25/50 only — the API rejects anything else with a 422 (BR-08).
          options={FINANCES_PAGE_SIZES.map((value) => ({
            value,
            label: `${value} / page`,
          }))}
        />
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export function FinancesPage() {
  const { t } = useTranslation(['finances', 'common'])
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const c = useFinancesPage()

  const columns = useMemo(
    () =>
      buildFinanceColumns(
        t,
        {
          onMinglerClick: c.openMingler,
          onInterestTableClick: (row) =>
            navigate(`/interest-tables/${row.interestTable.id}`, {
              state: { backLabel: t('common:backTo.finances') },
            }),
        },
        {
          sortBy: c.activeSort.sortBy,
          sortOrder: c.activeSort.sortOrder,
          searchField: c.activeSearch.searchField,
          search: c.activeSearch.search,
          range: c.activeRange,
        },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, navigate, c.activeSort, c.activeSearch, c.activeRange],
  )

  const handleTableChange: TableProps<FinanceLedgerRow>['onChange'] = (
    _pagination,
    filters,
    sorter,
  ) => {
    c.handleTableChange(filters, sorter)
  }

  if (c.isPending) {
    return (
      <div className="flex justify-center py-24">
        <Spin />
      </div>
    )
  }

  if (c.isError) {
    return (
      <Alert
        type="error"
        className="m-4"
        message={getApiErrorMessage(c.error, t('common:errors.fetchError'))}
      />
    )
  }

  const isEmpty = c.totalRecords === 0

  // A filter that matched nothing and a restaurant with no completed bookings at
  // all are different situations with different remedies — clear the filter vs.
  // wait for the first sitting — so they get different copy rather than one
  // shared line (MET-1301). Either way it is a normal 200, never an error
  // (AC-06.2).
  const noMatch = (
    <TabEmptyState
      IconComp={MagnifyingGlass}
      title={t('finances:noMatch.title')}
      description={t('finances:noMatch.description')}
      compact
    />
  )

  return (
    <div className="flex flex-col">
      {c.contextHolder}

      <FinancesPageHeader
        period={c.period}
        onSelectPeriod={c.selectPeriod}
        onExportCsv={c.handleExportCsv}
        exporting={c.exporting}
      />

      <EscrowPanel />

      {isEmpty && !c.hasFilters ? (
        // Nothing is filtered, so no control is lost by dropping the grid.
        <TabEmptyState
          IconComp={Receipt}
          title={t('finances:emptyState.title')}
          description={t('finances:emptyState.description')}
        />
      ) : (
        <>
          {/* The grid stays mounted while a filter is applied, even at zero rows:
              the column search boxes and the Date calendar live in its header, so
              taking it down used to strand the partner on a page whose own copy
              told them to change a filter that was no longer on screen. */}
          {isMobile ? (
            <FinancesCards rows={c.rows} onOpenDetail={c.openDetail} t={t} noMatch={noMatch} />
          ) : (
            <div className="finances-table">
              <Table<FinanceLedgerRow>
                dataSource={c.rows}
                columns={pinEndColumns(columns)}
                rowKey="bookingId"
                size="middle"
                loading={c.isFetching}
                pagination={false}
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: noMatch }}
                onChange={handleTableChange}
                onRow={(row) => ({
                  // Row-click opens the detail modal; the Mingler and Interest
                  // Table cells stop propagation so their links win (BR-12).
                  onClick: () => c.openDetail(row),
                  className: 'cursor-pointer',
                })}
              />
            </div>
          )}

          {/* "Showing 0–0 of 0" under an empty grid is noise, not information. */}
          {!isEmpty && (
            <FinancesPaginationRow
              page={c.page}
              pageSize={c.pageSize}
              total={c.totalRecords}
              onPageChange={c.setPage}
              onPageSizeChange={c.setPageSize}
              showSizeSelector={!isMobile}
              t={t}
            />
          )}
        </>
      )}

      <TransactionDetailModal
        open={!!c.detailBookingId}
        detail={c.detail}
        loading={c.detailPending}
        error={c.detailError}
        onClose={c.closeDetail}
      />

      {/* The shared J6F profile modal (endpoint 9, `GET /api/v1/partner/minglers/{id}`),
          the same one Interest Tables and Reviews open. It used to be the prototype
          `MinglerPreferencesModal`, which read the MSW-only `/api/minglers/{id}` and had
          no error branch at all: against the real backend that call never resolves, so the
          modal sat on "Loading…" forever with no title and no way to tell why (MET-1401). */}
      <MinglerProfileModal minglerId={c.minglerModalId} onClose={c.closeMingler} />
    </div>
  )
}
