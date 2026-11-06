import { Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Broadcast, PencilSimple } from '@phosphor-icons/react'
import type { TFunction } from 'i18next'
import type {
  InterestTableStatus,
  ListAllInterestTablesParams,
  MasterInterestTableItem,
} from '../types'
import { IT_SEARCH_FIELD_BY_COLUMN_KEY, IT_SORT_FIELD_BY_COLUMN_KEY } from '../constants'
import { EM_DASH, encodeRestaurantFilter, formatMasterListDateTime } from '../masterListHelpers'
import { LinkCell, ProminglerCell, TextCell } from './masterListCells'
import { funnelIcon, makeServerSearchFilter, tableSortIcon } from './interestTablesTableHelpers'
import { InterestTableStatusBadge } from './InterestTableStatusBadge'
import { RestaurantColumnFilter, type RestaurantFilterOption } from './RestaurantColumnFilter'
import { LabelTag } from '../../../atoms/LabelTag'
import { ActionIcon } from '../../minglers/components/MinglerActionIcon'
import { TableAvatar } from '../../../molecules/TableAvatar'

const STATUS_FILTERS: InterestTableStatus[] = [
  'DRAFT',
  'COMING_SOON',
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
]

export interface GlobalColumnCallbacks {
  onView: (row: MasterInterestTableItem) => void
  /** Opens the detail page in edit mode — offered on DRAFT rows only. */
  onEdit?: (row: MasterInterestTableItem) => void
  onRestaurantClick?: (restaurantId: string) => void
  onProminglerClick?: (minglerId: string) => void
  onMakeAvailable?: (id: string) => void
  restaurantOptions?: RestaurantFilterOption[]
}

/**
 * Master-list columns. Every filter and sort is fully controlled from `params`
 * (the server is the single source of truth) and no column declares `onFilter` —
 * the API does the filtering.
 */
export function buildGlobalInterestTablesColumns(
  params: ListAllInterestTablesParams,
  t: TFunction,
  {
    onEdit,
    onRestaurantClick,
    onProminglerClick,
    onMakeAvailable,
    restaurantOptions = [],
  }: GlobalColumnCallbacks,
): ColumnsType<MasterInterestTableItem> {
  const sortOrderFor = (columnKey: string): 'ascend' | 'descend' | null => {
    if (params.sortBy !== IT_SORT_FIELD_BY_COLUMN_KEY[columnKey]) return null
    return params.sortOrder === 'asc' ? 'ascend' : 'descend'
  }

  const searchValueFor = (columnKey: string): string[] | null => {
    const field = IT_SEARCH_FIELD_BY_COLUMN_KEY[columnKey]
    return params.searchField === field && params.search ? [params.search] : null
  }

  const restaurantSearch = params.searchField === 'restaurant' ? (params.search ?? '') : ''
  const restaurantFilterValue = encodeRestaurantFilter(restaurantSearch, params.restaurantId ?? [])

  return [
    {
      title: t('table.headers.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      sortOrder: sortOrderFor('name'),
      sortIcon: tableSortIcon,
      ...makeServerSearchFilter(t('table.search.name')),
      filteredValue: searchValueFor('name'),
      render: (value: string, row) => (
        <div className="flex items-center gap-3">
          <TableAvatar name={value} imageUrl={row.coverImageUrl} size={40} shape="rounded" />
          <span className="font-[Poppins] text-[14px] font-semibold text-[var(--color-text)]">
            {value}
          </span>
        </div>
      ),
    },
    {
      title: t('table.headers.restaurant'),
      key: 'restaurant',
      dataIndex: ['restaurant', 'name'],
      sorter: true,
      sortOrder: sortOrderFor('restaurant'),
      sortIcon: tableSortIcon,
      filterIcon: funnelIcon,
      filteredValue: restaurantFilterValue.length ? restaurantFilterValue : null,
      filterDropdown: (props) => (
        <RestaurantColumnFilter
          // Remount whenever the applied filter changes, so the dropdown's draft
          // state re-seeds from it (e.g. after an external Reset).
          key={restaurantFilterValue.join('|')}
          options={restaurantOptions}
          selectedKeys={props.selectedKeys}
          setSelectedKeys={props.setSelectedKeys}
          confirm={() => props.confirm()}
          clearFilters={props.clearFilters}
        />
      ),
      render: (_: unknown, row) => (
        <LinkCell
          label={row.restaurant?.name ?? EM_DASH}
          targetId={row.restaurant?.id}
          onClick={onRestaurantClick}
        />
      ),
    },
    {
      title: t('table.headers.dateTime'),
      key: 'dateTime',
      sorter: true,
      sortOrder: sortOrderFor('dateTime'),
      sortIcon: tableSortIcon,
      render: (_: unknown, row) => (
        <TextCell value={formatMasterListDateTime(row.startDate, row.startTime)} />
      ),
    },
    {
      title: t('table.headers.maxGuests'),
      dataIndex: 'maxGuests',
      key: 'maxGuests',
      align: 'left' as const,
      // Sort-only by contract — numeric columns are never searchable.
      sorter: true,
      sortOrder: sortOrderFor('maxGuests'),
      sortIcon: tableSortIcon,
      render: (value: number) =>
        value == null ? (
          <TextCell value={EM_DASH} tone="muted" />
        ) : (
          <TextCell value={String(value)} />
        ),
    },
    {
      title: t('mode.label'),
      dataIndex: 'availabilityMode',
      key: 'availabilityMode',
      filters: [
        { text: t('mode.available_now'), value: 'AVAILABLE_NOW' },
        { text: t('mode.coming_soon'), value: 'COMING_SOON' },
      ],
      filterMultiple: true,
      filteredValue: params.availabilityMode?.length ? params.availabilityMode : null,
      filterIcon: funnelIcon,
      render: (value: MasterInterestTableItem['availabilityMode']) =>
        value ? (
          <LabelTag>{t(`mode.${value.toLowerCase()}`)}</LabelTag>
        ) : (
          <TextCell value={EM_DASH} tone="muted" />
        ),
    },
    {
      title: t('inviteOnly.label'),
      dataIndex: 'inviteOnly',
      key: 'inviteOnly',
      // Boolean column → single-select; the API takes one `inviteOnly` value.
      filters: [
        { text: t('inviteOnly.yes'), value: 'yes' },
        { text: t('inviteOnly.no'), value: 'no' },
      ],
      filterMultiple: false,
      filteredValue: params.inviteOnly === undefined ? null : [params.inviteOnly ? 'yes' : 'no'],
      filterIcon: funnelIcon,
      render: (value: boolean) =>
        value == null ? (
          <TextCell value={EM_DASH} tone="muted" />
        ) : (
          <LabelTag>{value ? t('inviteOnly.yes') : t('inviteOnly.no')}</LabelTag>
        ),
    },
    {
      title: t('promingler.label'),
      key: 'promingler',
      render: (_: unknown, row) => (
        <ProminglerCell row={row} t={t} onProminglerClick={onProminglerClick} />
      ),
    },
    {
      title: t('table.headers.status'),
      dataIndex: 'status',
      key: 'status',
      filters: STATUS_FILTERS.map((status) => ({
        text: t(`status.${status.toLowerCase()}`),
        value: status,
      })),
      filterMultiple: true,
      filteredValue: params.status?.length ? params.status : null,
      filterIcon: funnelIcon,
      render: (value: InterestTableStatus) => <InterestTableStatusBadge status={value} />,
    },
    {
      // ACTIONS label removed by design; column pinned right.
      title: '',
      key: 'actions',
      align: 'right' as const,
      fixed: 'right' as const,
      width: 96,
      render: (_: unknown, row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {/* No view icon by design — the whole row navigates to the detail page. */}
          {onEdit && row.status === 'DRAFT' && (
            <Tooltip title={t('actions.edit')}>
              <ActionIcon
                hoverBg="var(--color-accent-light)"
                hoverColor="var(--color-accent)"
                onClick={() => onEdit(row)}
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
}
