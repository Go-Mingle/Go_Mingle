import { Avatar, Popover } from 'antd'
import { Info } from '@phosphor-icons/react'
import type { TFunction } from 'i18next'
import i18n from '../../../locales/i18n'
import { RestaurantInfoPopover } from './RestaurantInfoPopover'
import type { RestaurantInfo } from './RestaurantInfoPopover'
import { tableSortIcon, funnelIcon } from './components/financeFilterHelpers'

type Row = Record<string, unknown>

export const buildLegacyFinanceColumns = (t: TFunction) => [
  {
    title: t('finances:table.headers.restaurant'),
    dataIndex: 'restaurant',
    key: 'restaurant',
    sorter: (a: Row, b: Row) => (a.restaurant as string).localeCompare(b.restaurant as string),
    sortIcon: tableSortIcon,
    render: (v: string, row: Row) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar
          size={26}
          style={{
            backgroundColor: (row.avatarColor as string) ?? 'var(--color-accent)',
            fontSize: 10,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {(v as string)[0]}
        </Avatar>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>
          {(row.restaurantInfo as RestaurantInfo | undefined)?.name ?? v}
        </span>
        <Popover
          content={<RestaurantInfoPopover info={row.restaurantInfo as RestaurantInfo} />}
          trigger="click"
          placement="rightTop"
          overlayClassName="restaurant-info-popover"
          destroyTooltipOnHide
        >
          <Info
            size={14}
            style={{
              color: 'var(--color-text-subtle)',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'color 150ms ease-out',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as unknown as HTMLElement).style.color = 'var(--color-accent)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as unknown as HTMLElement).style.color = 'var(--color-text-subtle)'
            }}
          />
        </Popover>
      </div>
    ),
  },
  {
    title: t('finances:table.headers.bookingId'),
    dataIndex: 'bookingId',
    key: 'bookingId',
    render: (v: string) => (
      <span className="font-[var(--font-mono)] text-[12px] text-[var(--color-text-muted)]">
        {v}
      </span>
    ),
  },
  {
    title: t('finances:table.headers.mingler'),
    dataIndex: 'mingler',
    key: 'mingler',
    render: (v: string) => <span className="text-[13px] text-[var(--color-text-muted)]">{v}</span>,
  },
  {
    title: t('finances:table.headers.type'),
    dataIndex: 'type',
    key: 'type',
    filters: [
      { text: t('finances:filters.commission'), value: 'commission' },
      { text: t('finances:filters.penalty'), value: 'penalty' },
    ],
    filterIcon: funnelIcon,
    onFilter: (value: unknown, record: Row) => record.type === value,
    render: (v: string) => {
      const isCommission = v === 'commission'
      return (
        <span
          className="inline-flex items-center h-6 px-[10px] rounded-[var(--radius-pill)] text-[12px] font-semibold whitespace-nowrap"
          style={{
            background: isCommission ? 'var(--color-accent-light)' : 'var(--color-warning-bg)',
            color: isCommission ? 'var(--color-accent-dark)' : 'var(--color-warning)',
          }}
        >
          {isCommission ? t('finances:types.bookingCommission') : t('finances:types.penalty')}
        </span>
      )
    },
  },
  {
    title: t('finances:table.headers.partnerShare'),
    dataIndex: 'partnerShare',
    key: 'partnerShare',
    align: 'right' as const,
    render: (v: number) => (
      <span className="font-[var(--font-mono)] text-[12px] text-[var(--color-text-secondary)] block text-right">
        PKR {v.toLocaleString()}
      </span>
    ),
  },
  {
    title: t('finances:table.headers.gomingleShare'),
    dataIndex: 'gomingleShare',
    key: 'gomingleShare',
    align: 'right' as const,
    render: (v: number) => (
      <span className="font-[var(--font-mono)] text-[13px] font-semibold text-[var(--color-accent)] block text-right">
        PKR {v.toLocaleString()}
      </span>
    ),
  },
  {
    title: t('finances:table.headers.vat'),
    dataIndex: 'vat',
    key: 'vat',
    align: 'right' as const,
    render: (v: number) => (
      <span className="font-[var(--font-mono)] text-[12px] text-[var(--color-text-secondary)] block text-right">
        PKR {v.toFixed(2)}
      </span>
    ),
  },
  {
    title: t('finances:table.headers.tip'),
    dataIndex: 'tip',
    key: 'tip',
    align: 'right' as const,
    render: (v: number) =>
      v ? (
        <span className="font-[var(--font-mono)] text-[12px] text-[var(--color-text-secondary)] block text-right">
          PKR {v.toLocaleString()}
        </span>
      ) : (
        <span className="text-[13px] text-[var(--color-text-subtle)] block text-right">—</span>
      ),
  },
  {
    title: t('finances:table.headers.totalAmount'),
    dataIndex: 'totalAmount',
    key: 'totalAmount',
    align: 'right' as const,
    sorter: (a: Row, b: Row) => (a.totalAmount as number) - (b.totalAmount as number),
    sortIcon: tableSortIcon,
    render: (v: number) => (
      <span className="font-[var(--font-mono)] text-[14px] font-semibold text-[var(--color-text)] block text-right">
        PKR {v.toLocaleString()}
      </span>
    ),
  },
  {
    title: t('finances:table.headers.loyaltyUsed'),
    dataIndex: 'loyaltyUsed',
    key: 'loyaltyUsed',
    render: (v: number, row: Row) => {
      if (!v) return <span className="text-[13px] text-[var(--color-text-subtle)]">—</span>
      const deduction = row.loyaltyPkrDeduction as number
      return (
        <span className="font-[var(--font-mono)] text-[13px] text-[var(--color-text-secondary)]">
          {v}
          <span style={{ color: '#C0392B', fontSize: 12 }}>
            {' '}
            (-PKR {deduction % 1 === 0 ? deduction : deduction.toFixed(2)})
          </span>
        </span>
      )
    },
  },
  {
    title: t('finances:table.headers.date'),
    dataIndex: 'date',
    key: 'date',
    sorter: (a: Row, b: Row) => (a.date as string).localeCompare(b.date as string),
    sortIcon: tableSortIcon,
    render: (v: string) => (
      <span className="font-[var(--font-mono)] text-[12px] text-[var(--color-text-muted)]">
        {v}
      </span>
    ),
  },
]

// Backwards-compat: legacy default-locale snapshot for existing tests/imports.
export const financeColumns = buildLegacyFinanceColumns(i18n.t.bind(i18n) as TFunction)
