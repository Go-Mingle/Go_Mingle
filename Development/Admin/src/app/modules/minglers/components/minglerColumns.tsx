import type { Key } from 'react'
import type { ColumnsType } from 'antd/es/table'
import { Tooltip } from 'antd'
import { UserCircleMinus, UserCircleCheck } from '@phosphor-icons/react'
import dayjs from 'dayjs'
import { MinglerStatusBadge } from './MinglerStatusBadge'
import { ActionIcon } from './MinglerActionIcon'
import { ProminglerBadge } from '../../../molecules/ProminglerBadge'
import {
  tableSortIcon,
  funnelIcon,
  makeSearchFilter,
  makeDateFilter,
  sanitizePhoneInput,
} from './tableHelpers'
import { formatKarachiDateTime } from '../../../../shared/utils/dateHelpers'
import { MINGLER_SEARCH_MAX_LENGTH } from '../constants'
import i18n from '../../../../locales/i18n'
import type {
  ListMinglersQueryParams,
  MinglerListItem,
  MinglerListStatus,
  MinglersSearchField,
} from '../types'

interface BuildColumnsOptions {
  queryParams: ListMinglersQueryParams
  onSuspendClick: (record: MinglerListItem) => void
  onUnsuspendClick: (record: MinglerListItem) => void
  onSearchChange: (field: MinglersSearchField, value: string | undefined) => void
  onJoinedRangeChange: (from: string | undefined, to: string | undefined) => void
}

const textCell = (
  value: string | number,
  color: string,
  options: { fontSize?: number; fontWeight?: number } = {},
) => (
  <span
    style={{
      fontFamily: 'Poppins, sans-serif',
      fontSize: options.fontSize ?? 14,
      fontWeight: options.fontWeight ?? 500,
      color,
    }}
  >
    {value}
  </span>
)

export function buildMinglerColumns({
  queryParams,
  onSuspendClick,
  onUnsuspendClick,
  onSearchChange,
  onJoinedRangeChange,
}: BuildColumnsOptions): ColumnsType<MinglerListItem> {
  const t = i18n.t.bind(i18n)

  // Shared client-side guard for the Name/Phone/Email search filters: mirrors
  // the backend @MaxLength(100) so an over-length term shows an inline message
  // instead of being sent and blanking the listing (BUG-034).
  const searchValidation = {
    maxLength: MINGLER_SEARCH_MAX_LENGTH,
    message: t('minglers:table.search.tooLong'),
  }

  const sortOrderFor = (field: ListMinglersQueryParams['sortBy']) =>
    queryParams.sortBy === field ? (queryParams.sortOrder === 'asc' ? 'ascend' : 'descend') : null

  const searchFilteredValueFor = (value?: string) => (value ? [value] : [])

  const joinedFilteredValue = (queryParams.joinedFrom || queryParams.joinedTo
    ? [
        [
          queryParams.joinedFrom ? dayjs(queryParams.joinedFrom) : null,
          queryParams.joinedTo ? dayjs(queryParams.joinedTo) : null,
        ],
      ]
    : []) as unknown as Key[]

  return [
    {
      title: t('minglers:table.headers.name'),
      dataIndex: 'fullName',
      key: 'fullName',
      sorter: true,
      sortOrder: sortOrderFor('name'),
      sortIcon: tableSortIcon,
      filteredValue: searchFilteredValueFor(queryParams.name),
      ...makeSearchFilter(
        t('minglers:table.search.minglers'),
        (value) => onSearchChange('name', value),
        undefined,
        searchValidation,
      ),
      render: (v: string, record: MinglerListItem) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: record.avatarColor,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            {record.avatarUrl ? (
              <img
                src={record.avatarUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              record.initials
            )}
          </div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--color-text)',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            {v}
          </span>
          {record.isPromingler && <ProminglerBadge verified size={14} />}
        </div>
      ),
    },
    {
      title: t('minglers:table.headers.phone'),
      dataIndex: 'phone',
      key: 'phone',
      sorter: true,
      sortOrder: sortOrderFor('phone'),
      sortIcon: tableSortIcon,
      filteredValue: searchFilteredValueFor(queryParams.phone),
      ...makeSearchFilter(
        t('minglers:table.search.phone'),
        (value) => onSearchChange('phone', value),
        // Digits + a single leading "+" only; letters/symbols are stripped on
        // type and paste.
        sanitizePhoneInput,
        searchValidation,
      ),
      render: (v: string) => textCell(v, 'var(--color-text-secondary)'),
    },
    {
      title: t('minglers:table.headers.email'),
      dataIndex: 'email',
      key: 'email',
      sorter: true,
      sortOrder: sortOrderFor('email'),
      sortIcon: tableSortIcon,
      filteredValue: searchFilteredValueFor(queryParams.email),
      ...makeSearchFilter(
        t('minglers:table.search.email'),
        (value) => onSearchChange('email', value),
        undefined,
        searchValidation,
      ),
      render: (v: string) => textCell(v, 'var(--color-text-secondary)'),
    },
    {
      title: t('minglers:table.headers.joined'),
      dataIndex: 'joinedAt',
      key: 'joinedAt',
      sorter: true,
      sortOrder: sortOrderFor('joined_at'),
      sortIcon: tableSortIcon,
      filteredValue: joinedFilteredValue,
      ...makeDateFilter(onJoinedRangeChange),
      render: (v: string) =>
        textCell(v ? formatKarachiDateTime(v) : '—', 'var(--color-text-secondary)'),
    },
    {
      title: t('minglers:table.headers.bookings'),
      dataIndex: 'totalBookings',
      key: 'totalBookings',
      align: 'left' as const,
      sorter: true,
      sortOrder: sortOrderFor('bookings'),
      sortIcon: tableSortIcon,
      render: (v: number) => textCell(v, 'var(--color-text-secondary)'),
    },
    {
      title: t('minglers:table.headers.points'),
      dataIndex: 'loyaltyPoints',
      key: 'loyaltyPoints',
      sorter: true,
      sortOrder: sortOrderFor('loyalty_points'),
      sortIcon: tableSortIcon,
      render: (v: number) => textCell(v.toLocaleString(), 'var(--color-text-secondary)'),
    },
    {
      title: t('minglers:table.headers.status'),
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      sortOrder: sortOrderFor('status'),
      sortIcon: tableSortIcon,
      filters: [
        { text: t('minglers:table.filters.active'), value: 'ACTIVE' },
        { text: t('minglers:table.filters.suspended'), value: 'SUSPENDED' },
      ],
      filteredValue: (queryParams.statuses ?? []) as MinglerListStatus[],
      filterIcon: funnelIcon,
      render: (v: string) => <MinglerStatusBadge status={v} />,
    },
    {
      title: '',
      key: 'actions',
      width: 108,
      align: 'center' as const,
      render: (_: unknown, record: MinglerListItem) => {
        const status = record.status
        return (
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            onClick={(e) => e.stopPropagation()}
          >
            {status === 'ACTIVE' && (
              <Tooltip title={t('minglers:table.tooltips.suspend')} placement="top">
                <ActionIcon
                  hoverBg="var(--color-error-bg)"
                  hoverColor="var(--color-error)"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSuspendClick(record)
                  }}
                >
                  <UserCircleMinus size={17} weight="regular" />
                </ActionIcon>
              </Tooltip>
            )}
            {status === 'SUSPENDED' && (
              <Tooltip title={t('minglers:table.tooltips.unsuspend')} placement="top">
                <ActionIcon
                  hoverBg="var(--color-success-bg)"
                  hoverColor="var(--color-success)"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUnsuspendClick(record)
                  }}
                >
                  <UserCircleCheck size={17} weight="regular" />
                </ActionIcon>
              </Tooltip>
            )}
          </div>
        )
      },
    },
  ]
}
