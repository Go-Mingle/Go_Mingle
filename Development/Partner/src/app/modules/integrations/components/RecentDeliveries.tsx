import { Table, Pagination, Grid, Tooltip, Segmented } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { FilterValue } from 'antd/es/table/interface'
import { pinEndColumns } from '../../../molecules/tableColumns'
import type { TFunction } from 'i18next'
import { ArrowsClockwise, Broadcast } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { DeliveryStatusBadge } from './DeliveryStatusBadge'
import { LabelTag } from '../../../atoms/LabelTag'
import { TabEmptyState } from '../../restaurants/components/TabEmptyState'
import { CardDetailRow, RESPONSIVE_CARD_CLASS } from '../../../molecules/CardDetailRow'
import { funnelIcon } from './webhookTableHelpers'
import { deliveryRowKey } from '../webhookMeta'
import { DELIVERIES_PAGE_SIZE } from '../constants'
import type { DeliveryStatusFilter, WebhookDeliveryRow } from '../types'

/**
 * The 30-day delivery log (BR-13).
 *
 * Everything is server-resolved: the API paginates and offers exactly one
 * filter — status. It has no sort, no search and no event-type filter, so the
 * columns carry none either; a client-side comparator would reorder the single
 * page in hand while disagreeing with the total beneath it.
 *
 * The status control lives in the toolbar on both breakpoints (BR-13, AC-06.2,
 * §UX Artifacts: "Refresh; status filter; pagination"). Desktop keeps the column
 * funnel as well — both read the same `statusFilter` prop, so they cannot
 * disagree — but the funnel alone is not the filter: it is an unlabelled glyph in
 * a header cell, which is how three earlier partner lists were read as shipping
 * without a filter at all.
 *
 * Rows are deliberately non-interactive — no payload or response drill-down
 * exists (AC-06.3).
 *
 * One row may not be the server's: MET-1277 prepends a local `QUEUED` marker for
 * a test send that has been accepted but not yet recorded. It is flagged
 * `pending`, and the columns read that flag rather than inventing a try count or
 * a failure reason for a delivery that has not been attempted yet.
 */

const FILTERS: DeliveryStatusFilter[] = ['ALL', 'DELIVERED', 'RETRYING', 'FAILED']

/** Filter labels are keyed lowercase to match the existing i18n block. */
const FILTER_KEY: Record<DeliveryStatusFilter, string> = {
  ALL: 'all',
  DELIVERED: 'delivered',
  RETRYING: 'retrying',
  FAILED: 'failed',
}

const filterLabel = (t: TFunction, f: DeliveryStatusFilter) =>
  t(`deliveries.filters.${FILTER_KEY[f]}`)

/** Shared by Refresh and the empty state's "show all" escape hatch. */
const TOOLBAR_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-card)] text-[13px] font-medium text-[var(--color-text-secondary)] cursor-pointer md:hover:border-[var(--color-text-muted)] md:hover:text-[var(--color-text)] transition-colors disabled:opacity-50'

interface RecentDeliveriesProps {
  deliveries: WebhookDeliveryRow[]
  total: number
  page: number
  onPageChange: (page: number) => void
  statusFilter: DeliveryStatusFilter
  onStatusFilterChange: (status: DeliveryStatusFilter) => void
  onRefresh: () => void
  refreshing?: boolean
}

const TEST_TAG_STYLE = {
  background: 'var(--color-accent-light)',
  color: 'var(--color-accent-dark)',
  height: 20,
  fontSize: 10,
}

// Uniform table cell text — matches the finances module (14 / 500 / secondary).
const CELL_STYLE = {
  fontFamily: 'Poppins, sans-serif',
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
} as const

const testTag = (t: TFunction, d: WebhookDeliveryRow) =>
  d.isTest ? <LabelTag style={TEST_TAG_STYLE}>{t('deliveries.testTag')}</LabelTag> : null

/** No attempt has been reported for a queued row, so there is no count to show. */
const triesText = (d: WebhookDeliveryRow) => (d.pending ? '—' : String(d.tries))

function buildColumns(
  t: TFunction,
  statusFilter: DeliveryStatusFilter,
): ColumnsType<WebhookDeliveryRow> {
  return [
    {
      title: t('deliveries.cols.event'),
      key: 'event',
      render: (_, d) => (
        <span className="inline-flex items-center gap-2" style={CELL_STYLE}>
          {/* Pre-rendered by the backend, e.g. "Interest table · Published". */}
          {d.eventLabel}
          {testTag(t, d)}
        </span>
      ),
    },
    {
      title: t('deliveries.cols.tries'),
      key: 'tries',
      render: (_, d) => <span style={CELL_STYLE}>{triesText(d)}</span>,
    },
    {
      title: t('deliveries.cols.reason'),
      key: 'reason',
      render: (_, d) => <span style={CELL_STYLE}>{d.reason ?? '—'}</span>,
    },
    {
      title: t('deliveries.cols.when'),
      key: 'when',
      render: (_, d) => (
        // whenRelative is what the backend renders; occurredAt backs the tooltip.
        <Tooltip title={new Date(d.occurredAt).toLocaleString()}>
          <span style={CELL_STYLE} className="whitespace-nowrap">
            {d.whenRelative}
          </span>
        </Tooltip>
      ),
    },
    {
      title: t('deliveries.cols.status'),
      key: 'status',
      // Single-select: the API takes one status, and FAILED covers both terminal
      // states (FAILED and FAILED_EMAILED).
      filters: [
        { text: t('deliveries.delivered'), value: 'DELIVERED' },
        { text: t('deliveries.retrying'), value: 'RETRYING' },
        { text: t('deliveries.failed'), value: 'FAILED' },
      ],
      filterMultiple: false,
      filteredValue: statusFilter === 'ALL' ? null : [statusFilter],
      filterIcon: (filtered: boolean) => funnelIcon(filtered, t('deliveries.filterAria')),
      render: (_, d) => <DeliveryStatusBadge status={d.status} />,
    },
  ]
}

function RefreshButton({
  onRefresh,
  refreshing,
  label,
  iconOnly,
}: {
  onRefresh: () => void
  refreshing?: boolean
  label: string
  iconOnly?: boolean
}) {
  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label={label}
        className="shrink-0 w-9 h-9 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-card)] flex items-center justify-center text-[var(--color-text-secondary)] cursor-pointer disabled:opacity-50"
      >
        <ArrowsClockwise size={15} className={refreshing ? 'animate-spin' : undefined} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={refreshing}
      className={TOOLBAR_BUTTON_CLASS}
    >
      <ArrowsClockwise size={15} className={refreshing ? 'animate-spin' : undefined} />
      {label}
    </button>
  )
}

/** The desktop status filter — the control AC-06.2 asks for, in the toolbar. */
function StatusFilter({
  statusFilter,
  onStatusFilterChange,
  t,
}: {
  statusFilter: DeliveryStatusFilter
  onStatusFilterChange: (status: DeliveryStatusFilter) => void
  t: TFunction
}) {
  return (
    <Segmented<DeliveryStatusFilter>
      size="small"
      value={statusFilter}
      onChange={onStatusFilterChange}
      aria-label={t('deliveries.filterAria')}
      options={FILTERS.map((f) => ({ value: f, label: filterLabel(t, f) }))}
    />
  )
}

/**
 * Two different empty states. "No deliveries yet" is wrong when the log holds 59
 * rows and the active filter matches none of them — it tells the partner to go
 * configure webhooks that are already delivering.
 */
function EmptyDeliveries({
  t,
  filtered,
  onClearFilter,
}: {
  t: TFunction
  filtered: boolean
  onClearFilter: () => void
}) {
  if (filtered) {
    return (
      <TabEmptyState
        IconComp={Broadcast}
        title={t('deliveries.emptyFiltered')}
        description={t('deliveries.emptyFilteredHint')}
        compact
        action={
          <button type="button" onClick={onClearFilter} className={TOOLBAR_BUTTON_CLASS}>
            {t('deliveries.clearFilter')}
          </button>
        }
      />
    )
  }

  return (
    <TabEmptyState
      IconComp={Broadcast}
      title={t('deliveries.empty')}
      description={t('deliveries.emptyHint')}
      compact
    />
  )
}

function MobileDeliveries({
  deliveries,
  total,
  page,
  onPageChange,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  refreshing,
  t,
}: RecentDeliveriesProps & { t: TFunction }) {
  return (
    <div>
      {/* One line: all filters + icon-only refresh */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const active = statusFilter === f
          return (
            <button
              key={f}
              type="button"
              onClick={() => onStatusFilterChange(f)}
              className={`text-[12.5px] font-medium px-3 py-1.5 rounded-full border cursor-pointer whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                  : 'bg-transparent border-[var(--color-border-strong)] text-[var(--color-text-secondary)]'
              }`}
            >
              {filterLabel(t, f)}
            </button>
          )
        })}
        <RefreshButton
          onRefresh={onRefresh}
          refreshing={refreshing}
          label={t('deliveries.refresh')}
          iconOnly
        />
      </div>

      {deliveries.length === 0 ? (
        <EmptyDeliveries
          t={t}
          filtered={statusFilter !== 'ALL'}
          onClearFilter={() => onStatusFilterChange('ALL')}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {deliveries.map((d, index) => (
            <div key={deliveryRowKey(d, index)} className={RESPONSIVE_CARD_CLASS}>
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-[var(--color-text)] min-w-0">
                  <span className="truncate">{d.eventLabel}</span>
                  {testTag(t, d)}
                </span>
                <DeliveryStatusBadge status={d.status} />
              </div>
              <div className="flex flex-col gap-2.5">
                <CardDetailRow label={t('deliveries.cols.tries')} value={triesText(d)} />
                <CardDetailRow label={t('deliveries.cols.reason')} value={d.reason ?? '—'} />
                <CardDetailRow label={t('deliveries.cols.when')} value={d.whenRelative} />
              </div>
            </div>
          ))}
        </div>
      )}

      {total > DELIVERIES_PAGE_SIZE && (
        <div className="flex justify-center mt-4">
          <Pagination
            current={page}
            total={total}
            pageSize={DELIVERIES_PAGE_SIZE}
            onChange={onPageChange}
            showSizeChanger={false}
            size="small"
          />
        </div>
      )}
    </div>
  )
}

function DesktopDeliveries({
  deliveries,
  total,
  page,
  onPageChange,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  refreshing,
  t,
}: RecentDeliveriesProps & { t: TFunction }) {
  const columns = buildColumns(t, statusFilter)

  const handleChange = (filters: Record<string, FilterValue | null>) => {
    const selected = (filters.status?.[0] as DeliveryStatusFilter | undefined) ?? 'ALL'
    if (selected !== statusFilter) onStatusFilterChange(selected)
  }

  return (
    <div>
      {/* Toolbar sits above the empty-state branch: a filter that disappears with
          the table it emptied leaves no way back to All. */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <StatusFilter
          statusFilter={statusFilter}
          onStatusFilterChange={onStatusFilterChange}
          t={t}
        />
        <RefreshButton
          onRefresh={onRefresh}
          refreshing={refreshing}
          label={t('deliveries.refresh')}
        />
      </div>

      {deliveries.length === 0 ? (
        <EmptyDeliveries
          t={t}
          filtered={statusFilter !== 'ALL'}
          onClearFilter={() => onStatusFilterChange('ALL')}
        />
      ) : (
        <div className="webhook-deliveries-table">
          <Table<WebhookDeliveryRow>
            dataSource={deliveries}
            columns={pinEndColumns(columns)}
            rowKey={deliveryRowKey}
            size="middle"
            loading={refreshing}
            pagination={{
              current: page,
              total,
              pageSize: DELIVERIES_PAGE_SIZE,
              showSizeChanger: false,
              size: 'small',
              onChange: onPageChange,
            }}
            onChange={(_pagination, filters) => handleChange(filters)}
            scroll={{ x: 'max-content' }}
          />
        </div>
      )}
    </div>
  )
}

export function RecentDeliveries(props: RecentDeliveriesProps) {
  const { t } = useTranslation('integrations')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  return isMobile ? <MobileDeliveries {...props} t={t} /> : <DesktopDeliveries {...props} t={t} />
}
