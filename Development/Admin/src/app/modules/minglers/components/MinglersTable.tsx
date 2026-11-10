import { Table } from 'antd'
import { withFixedEnds } from '../../../molecules/withFixedEnds'
import type { TableProps } from 'antd'
import { buildMinglerColumns } from './minglerColumns'
import type {
  ListMinglersQueryParams,
  MinglerListItem,
  MinglerListStatus,
  MinglersSortBy,
} from '../types'

interface MinglersTableProps {
  data: MinglerListItem[]
  loading?: boolean
  queryParams: ListMinglersQueryParams
  onQueryParamsChange: (params: Partial<ListMinglersQueryParams>) => void
  onRowClick: (id: string) => void
  onSuspendClick: (record: MinglerListItem) => void
  onUnsuspendClick: (record: MinglerListItem) => void
}

const SORT_FIELD_MAP: Record<string, MinglersSortBy> = {
  fullName: 'name',
  phone: 'phone',
  email: 'email',
  joinedAt: 'joined_at',
  totalBookings: 'bookings',
  loyaltyPoints: 'loyalty_points',
  status: 'status',
}

export function MinglersTable({
  data,
  loading,
  queryParams,
  onQueryParamsChange,
  onRowClick,
  onSuspendClick,
  onUnsuspendClick,
}: MinglersTableProps) {
  // The row itself is clickable (see onRow below), so the View action
  // icon was removed from buildMinglerColumns.
  const columns = buildMinglerColumns({
    queryParams,
    onSuspendClick,
    onUnsuspendClick,
    onSearchChange: (field, value) => onQueryParamsChange({ [field]: value || undefined }),
    onJoinedRangeChange: (from, to) => onQueryParamsChange({ joinedFrom: from, joinedTo: to }),
  })

  const handleChange: TableProps<MinglerListItem>['onChange'] = (_p, filters, sorter) => {
    const statusValues = filters['status'] as MinglerListStatus[] | null
    const partial: Partial<ListMinglersQueryParams> = {
      statuses: statusValues && statusValues.length > 0 ? statusValues : undefined,
    }

    const single = Array.isArray(sorter) ? sorter[0] : sorter
    if (single?.order) {
      partial.sortBy = SORT_FIELD_MAP[single.columnKey as string]
      partial.sortOrder = single.order === 'descend' ? 'desc' : 'asc'
    } else {
      // AntD nulls columnKey/field/order together once a sort is cancelled
      // (the click past descend) — clear sorting entirely so no column
      // shows an active sort and the API receives no sort params.
      partial.sortBy = undefined
      partial.sortOrder = undefined
    }

    onQueryParamsChange(partial)
  }

  return (
    <div className="minglers-table">
      <Table<MinglerListItem>
        dataSource={data}
        columns={withFixedEnds(columns)}
        rowKey="id"
        size="middle"
        loading={loading}
        pagination={false}
        scroll={{ x: 'max-content' }}
        onChange={handleChange}
        onRow={(record) => ({
          onClick: () => onRowClick(record.id),
          style: { cursor: 'pointer' },
        })}
      />
    </div>
  )
}
