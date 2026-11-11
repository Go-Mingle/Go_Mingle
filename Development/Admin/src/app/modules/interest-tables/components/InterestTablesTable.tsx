import { Table, Grid, Tooltip } from 'antd'
import { withFixedEnds } from '../../../molecules/withFixedEnds'
import type { ColumnsType } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { PencilSimple, Broadcast } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { InterestTable, InterestTableStatus } from '../types'
import { makeServerSearchFilter, funnelIcon, tableSortIcon } from './interestTablesTableHelpers'
import { formatTableDateTime } from '../../../../shared/utils/dateHelpers'
import { InterestTableStatusBadge } from './InterestTableStatusBadge'
import { LabelTag } from '../../../atoms/LabelTag'
import { ProminglerBadge } from '../../../molecules/ProminglerBadge'
import { ActionIcon } from '../../minglers/components/MinglerActionIcon'
import { TableAvatar } from '../../../molecules/TableAvatar'

/** Statuses whose table has not happened yet, so it can still be edited. */
const EDITABLE_STATUSES: string[] = ['DRAFT', 'PENDING', 'CONFIRMED', 'COMING_SOON']

export type InterestTableModeFilter = 'AVAILABLE_NOW' | 'COMING_SOON'
export type InviteOnlyFilter = 'yes' | 'no'

/**
 * All filter values surfaced by the table. `q` + `status` are server-side
 * (the parent forwards them to the API); `mode` + `inviteOnly` have no backend
 * param (J10B) so the parent applies them client-side to the current page.
 * Every filterable column is fully controlled via `filteredValue` — AntD does
 * not support mixing controlled columns with uncontrolled `onFilter` columns.
 */
export interface InterestTablesFilters {
  q?: string
  status?: InterestTableStatus
  mode?: InterestTableModeFilter
  inviteOnly?: InviteOnlyFilter
  // Server-side sort → API `sortBy` / `sortOrder`. `name` column maps to
  // sortBy `name`, the date column (`dateTime`) maps to sortBy `created`.
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

// Maps a sortable column's `key` to its API `sortBy` value.
const SORT_KEY_MAP: Record<string, string> = {
  name: 'name',
  dateTime: 'created',
}

interface InterestTablesTableProps {
  pagedData: InterestTable[]
  onView: (id: string) => void
  /** Redesign shells — when provided, render the Edit / Make-available row actions. */
  onEdit?: (id: string) => void
  onMakeAvailable?: (id: string) => void
  /** When provided, the Pro Mingler name becomes a link to that mingler's detail page. */
  onProminglerClick?: (minglerId: string) => void
  /** Current filter values (controls every filterable column). */
  filters?: InterestTablesFilters
  /** Fired when any column filter changes → parent re-queries / re-filters. */
  onFiltersChange?: (filters: InterestTablesFilters) => void
}

const textCell = (value: string, color: string) => (
  <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 14, fontWeight: 500, color }}>
    {value}
  </span>
)

const CARD_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--color-text-subtle)',
  fontFamily: 'Poppins, sans-serif',
  marginBottom: 3,
}

const STATUS_FILTERS: InterestTableStatus[] = [
  'DRAFT',
  'COMING_SOON',
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
]

export function InterestTablesTable({
  pagedData,
  onView,
  onEdit,
  onMakeAvailable,
  onProminglerClick,
  filters,
  onFiltersChange,
}: InterestTablesTableProps) {
  const { t } = useTranslation('interest-tables')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  // Pro Mingler cell — shared by the desktop column and the mobile card. When
  // `onProminglerClick` is provided the name becomes a link (scoped per-parent).
  const renderPromingler = (row: InterestTable) => {
    if (!(row.prominglerEnabled && row.promingler)) {
      return textCell('—', 'var(--color-text-subtle)')
    }
    const name = row.promingler.fullName ?? row.promingler.name ?? ''
    const minglerId = row.promingler.id
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {onProminglerClick && minglerId ? (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation()
              onProminglerClick(minglerId)
            }}
            className="cursor-pointer text-[var(--color-accent)] hover:underline"
          >
            {name}
          </span>
        ) : (
          textCell(name, 'var(--color-text-secondary)')
        )}
        <ProminglerBadge verified label={false} />
      </span>
    )
  }

  const columns: ColumnsType<InterestTable> = [
    {
      title: t('table.headers.name'),
      dataIndex: 'name',
      key: 'name',
      // Server-side sort → API `sortBy=name`.
      sorter: true,
      sortIcon: tableSortIcon,
      // Server-side search → API `q` param (no client onFilter).
      ...makeServerSearchFilter(t('table.search.name')),
      filteredValue: filters?.q ? [filters.q] : null,
      render: (v: string, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TableAvatar name={v} imageUrl={row.eventImageUrl} size={40} shape="rounded" />
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text)',
            }}
          >
            {v}
          </span>
        </div>
      ),
    },
    {
      title: t('table.headers.dateTime'),
      dataIndex: 'created',
      key: 'dateTime',
      // Server-side sort → API `sortBy=created`.
      sorter: true,
      sortIcon: tableSortIcon,
      render: (v: string) => textCell(formatTableDateTime(v) || '—', 'var(--color-text-secondary)'),
    },
    {
      title: t('table.headers.maxGuests'),
      key: 'maxGuests',
      align: 'left' as const,
      render: (_: unknown, row) =>
        textCell(String(row.maxGuests ?? '—'), 'var(--color-text-secondary)'),
    },
    {
      title: t('mode.label'),
      dataIndex: 'availabilityMode',
      key: 'availabilityMode',
      // Client-side filter (parent applies it): the backend exposes no
      // `mode`/availability query param (J10B). Controlled via filteredValue.
      filters: [
        { text: t('mode.available_now'), value: 'AVAILABLE_NOW' },
        { text: t('mode.coming_soon'), value: 'COMING_SOON' },
      ],
      filterMultiple: false,
      filteredValue: filters?.mode ? [filters.mode] : null,
      filterIcon: funnelIcon,
      render: (_: unknown, row) =>
        row.availabilityMode ? (
          <LabelTag>{t(`mode.${row.availabilityMode.toLowerCase()}`)}</LabelTag>
        ) : (
          textCell('—', 'var(--color-text-subtle)')
        ),
    },
    {
      title: t('inviteOnly.label'),
      dataIndex: 'inviteOnly',
      key: 'inviteOnly',
      // Client-side filter (parent applies it): no backend `inviteOnly` query
      // param exists (J10B). Controlled via filteredValue.
      filters: [
        { text: t('inviteOnly.yes'), value: 'yes' },
        { text: t('inviteOnly.no'), value: 'no' },
      ],
      filterMultiple: false,
      filteredValue: filters?.inviteOnly ? [filters.inviteOnly] : null,
      filterIcon: funnelIcon,
      render: (_: unknown, row) =>
        row.inviteOnly == null ? (
          textCell('—', 'var(--color-text-subtle)')
        ) : (
          <LabelTag>{row.inviteOnly ? t('inviteOnly.yes') : t('inviteOnly.no')}</LabelTag>
        ),
    },
    {
      title: t('promingler.label'),
      key: 'promingler',
      render: (_: unknown, row) => renderPromingler(row),
    },
    {
      title: t('table.headers.status'),
      dataIndex: 'status',
      key: 'status',
      // Server-side filter → API `status` param. Single-select: the endpoint
      // accepts one status value (no client onFilter).
      filters: STATUS_FILTERS.map((status) => ({
        text: t(`status.${status.toLowerCase()}`),
        value: status,
      })),
      filterMultiple: false,
      filteredValue: filters?.status ? [filters.status] : null,
      filterIcon: funnelIcon,
      render: (v: InterestTable['status']) => <InterestTableStatusBadge status={v} />,
    },
    {
      // ACTIONS label removed by design; column pinned right (width 96).
      title: '',
      key: 'actions',
      align: 'right' as const,
      fixed: 'right' as const,
      width: 96,
      render: (_: unknown, row) => (
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}
          onClick={(e) => e.stopPropagation()}
        >
          {onEdit && EDITABLE_STATUSES.includes(row.status) && (
            <Tooltip title={t('actions.edit')}>
              <ActionIcon
                hoverBg="var(--color-accent-light)"
                hoverColor="var(--color-accent)"
                onClick={() => onEdit(row.id)}
              >
                <PencilSimple size={16} weight="regular" />
              </ActionIcon>
            </Tooltip>
          )}
          {onMakeAvailable && row.status === 'COMING_SOON' && (
            <Tooltip title={t('actions.makeAvailable')}>
              <ActionIcon
                hoverBg="var(--color-accent-light)"
                hoverColor="var(--color-accent)"
                onClick={() => onMakeAvailable(row.id)}
              >
                <Broadcast size={16} weight="regular" />
              </ActionIcon>
            </Tooltip>
          )}
        </div>
      ),
    },
  ]

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pagedData.map((row) => (
          <div
            key={row.id}
            onClick={() => onView(row.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onView(row.id)
            }}
            style={{
              background: 'var(--color-card)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-sm)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              cursor: 'pointer',
            }}
          >
            {/* Row 1 — thumbnail + name + status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <img
                  src={row.eventImageUrl ?? ''}
                  alt={row.name}
                  loading="lazy"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    objectFit: 'cover',
                    flexShrink: 0,
                    background: 'var(--color-divider)',
                  }}
                />
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      fontFamily: 'Poppins, sans-serif',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.name}
                  </span>
                </div>
              </div>
              <InterestTableStatusBadge status={row.status} />
            </div>

            {/* Row 2 — date & time + max guests */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={CARD_LABEL}>{t('table.headers.dateTime')}</div>
                {textCell(formatTableDateTime(row.created) || '—', 'var(--color-text-secondary)')}
              </div>
              <div>
                <div style={CARD_LABEL}>{t('table.headers.maxGuests')}</div>
                {textCell(String(row.maxGuests ?? '—'), 'var(--color-text-secondary)')}
              </div>
            </div>

            {/* Row 3 — availability + promingler */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                paddingTop: 10,
                borderTop: '1px solid var(--color-divider)',
              }}
            >
              <div>
                <div style={CARD_LABEL}>{t('mode.label')}</div>
                {row.availabilityMode ? (
                  <LabelTag>{t(`mode.${row.availabilityMode.toLowerCase()}`)}</LabelTag>
                ) : (
                  textCell('—', 'var(--color-text-subtle)')
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={CARD_LABEL}>{t('promingler.label')}</div>
                {renderPromingler(row)}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="interest-tables-table">
      <Table<InterestTable>
        dataSource={pagedData}
        columns={withFixedEnds(columns)}
        rowKey="id"
        size="middle"
        pagination={false}
        scroll={{ x: 'max-content' }}
        onChange={(_p, f, sorter) => {
          // Surface every column filter + sort to the parent. q + status + sort
          // drive the API query; mode + inviteOnly are applied client-side by
          // the parent.
          const s = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<InterestTable>
          const sortBy = s?.order ? SORT_KEY_MAP[String(s.columnKey)] : undefined
          const sortOrder = s?.order ? (s.order === 'descend' ? 'DESC' : 'ASC') : undefined
          onFiltersChange?.({
            q: (f.name?.[0] as string | undefined) ?? undefined,
            status: (f.status?.[0] as InterestTableStatus | undefined) ?? undefined,
            mode: (f.availabilityMode?.[0] as InterestTableModeFilter | undefined) ?? undefined,
            inviteOnly: (f.inviteOnly?.[0] as InviteOnlyFilter | undefined) ?? undefined,
            sortBy,
            sortOrder,
          })
        }}
        onRow={(record) => ({
          onClick: () => onView(record.id),
          style: { cursor: 'pointer' },
        })}
      />
    </div>
  )
}
