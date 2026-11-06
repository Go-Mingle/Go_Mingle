import type { ColumnsType } from 'antd/es/table'
import { Tag, UserCircleMinus, UserCircleCheck, MagnifyingGlass } from '@phosphor-icons/react'
import type { Restaurant } from './restaurantsPage.types'
import { categoryColors, statusColors, statusLabels } from './restaurantsPage.types'
import { tableSortIcon, funnelIcon } from './RestaurantsTableIcons'
import { ActionBtn } from './RestaurantActionBtn'
import { buildRestaurantNameColumn } from './RestaurantNameColumn'
import { restaurantJoinedColumn } from './RestaurantJoinedColumn'
import { TableSearchFilter } from './TableSearchFilter'
import { DIRECTORY_STATUSES } from '../constants'
import i18n from '../../../../locales/i18n'

export function buildRestaurantsColumns(
  categoryOptions: { text: string; value: string }[],
  onSuspend?: (record: Restaurant) => void,
  onUnsuspend?: (record: Restaurant) => void,
  onChangeCategory?: (record: Restaurant) => void,
): ColumnsType<Restaurant> {
  const t = i18n.t.bind(i18n)
  return [
    buildRestaurantNameColumn(t),

    // ── City ──────────────────────────────────────────────────
    {
      title: t('restaurants:table.headers.city'),
      dataIndex: 'city',
      key: 'city',
      sorter: true,
      sortIcon: tableSortIcon,
      filterDropdown: (props) => (
        <TableSearchFilter {...props} placeholder={t('restaurants:table.search.city')} />
      ),
      filterIcon: (filtered: boolean) => (
        <MagnifyingGlass
          size={14}
          weight={filtered ? 'fill' : 'regular'}
          style={{ color: filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}
        />
      ),
      render: (city: string) => (
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
          }}
        >
          {city}
        </span>
      ),
    },

    // ── Category ─────────────────────────────────────────────
    {
      title: t('restaurants:table.headers.category'),
      dataIndex: 'category',
      key: 'category',
      sorter: true,
      sortIcon: tableSortIcon,
      filters: categoryOptions,
      filterIcon: funnelIcon,
      render: (cat: string) => {
        const colors = categoryColors[cat] ?? { bg: '#F1F3F6', text: 'var(--color-text-secondary)' }
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 24,
              padding: '0 8px',
              borderRadius: 4,
              background: colors.bg,
              color: colors.text,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {cat}
          </span>
        )
      },
    },

    // ── Bookings ──────────────────────────────────────────────
    {
      title: t('restaurants:table.headers.bookings'),
      dataIndex: 'bookings',
      key: 'bookings',
      align: 'left' as const,
      sorter: true,
      sortIcon: tableSortIcon,
      render: (n: number) => (
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
          }}
        >
          {n.toLocaleString()}
        </span>
      ),
    },

    restaurantJoinedColumn,

    // ── Status ────────────────────────────────────────────────
    {
      title: t('restaurants:table.headers.status'),
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      sortIcon: tableSortIcon,
      // CR-45 — Pending/Rejected are deliberately absent: the API 422s on them.
      filters: DIRECTORY_STATUSES.map((s) => ({ text: statusLabels[s], value: s })),
      filterIcon: funnelIcon,
      render: (status: string) => (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 24,
            padding: '0 10px',
            borderRadius: 4,
            background: statusColors[status] ?? 'var(--color-text-secondary)',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {statusLabels[status] ?? status}
        </span>
      ),
    },

    // ── Actions ───────────────────────────────────────────────
    {
      title: '',
      key: 'actions',
      width: 80,
      align: 'left' as const,
      render: (_, record) => (
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 4 }}
          onClick={(e) => e.stopPropagation()}
        >
          <ActionBtn
            tooltip={t('restaurants:table.tooltips.changeCategory')}
            hoverBg="var(--color-accent-light)"
            hoverColor="var(--color-accent)"
            onClick={() => onChangeCategory?.(record)}
          >
            <Tag size={17} weight="regular" />
          </ActionBtn>
          {record.status === 'ACTIVE' && (
            <ActionBtn
              tooltip={t('restaurants:table.tooltips.suspend')}
              hoverBg="var(--color-error-bg)"
              hoverColor="var(--color-error)"
              onClick={() => onSuspend?.(record)}
            >
              <UserCircleMinus size={17} weight="regular" />
            </ActionBtn>
          )}
          {record.status === 'SUSPENDED' && (
            <ActionBtn
              tooltip={t('restaurants:table.tooltips.unsuspend')}
              hoverBg="var(--color-success-bg)"
              hoverColor="var(--color-success)"
              onClick={() => onUnsuspend?.(record)}
            >
              <UserCircleCheck size={17} weight="regular" />
            </ActionBtn>
          )}
        </div>
      ),
    },
  ]
}
