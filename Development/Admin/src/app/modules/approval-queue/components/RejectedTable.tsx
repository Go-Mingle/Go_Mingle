import { Table, Tooltip } from 'antd'
import { withFixedEnds } from '../../../molecules/withFixedEnds'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import type { Application, ListApprovalsQueryParams } from '../types'
import {
  tableSortIcon,
  searchFilterDropdown,
  searchFilterIcon,
  mapTableChange,
} from './tableHelpers'
import { RestaurantCell } from './RestaurantCell'

interface RejectedTableProps {
  data: Application[]
  loading?: boolean
  onQueryParamsChange: (params: Partial<ListApprovalsQueryParams>) => void
}

const cellCls = 'text-sm font-medium text-(--color-text-muted) [font-family:var(--font-ui)]'

export function RejectedTable({ data, loading, onQueryParamsChange }: RejectedTableProps) {
  const navigate = useNavigate()
  const { t } = useTranslation('approval-queue')

  const columns: ColumnsType<Application> = [
    {
      title: t('table.headers.restaurant'),
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      sortIcon: tableSortIcon,
      filterDropdown: searchFilterDropdown(t('table.searchRestaurants')),
      filterIcon: searchFilterIcon,
      render: (v: string, row: Application) => <RestaurantCell name={v} cuisine={row.cuisine} />,
    },
    {
      title: t('table.headers.owner'),
      dataIndex: 'owner',
      key: 'owner',
      sorter: true,
      sortIcon: tableSortIcon,
      filterDropdown: searchFilterDropdown(t('table.searchOwners')),
      filterIcon: searchFilterIcon,
      render: (v: string) => (
        <span className="text-sm font-medium text-(--color-text-secondary) [font-family:var(--font-ui)]">
          {v}
        </span>
      ),
    },
    {
      title: t('table.headers.city'),
      dataIndex: 'city',
      key: 'city',
      sorter: true,
      sortIcon: tableSortIcon,
      filterDropdown: searchFilterDropdown(t('table.searchCity')),
      filterIcon: searchFilterIcon,
      render: (v: string) => <span className={cellCls}>{v}</span>,
    },
    {
      title: t('table.headers.submitted'),
      dataIndex: 'submitted',
      key: 'submitted',
      sorter: true,
      sortIcon: tableSortIcon,
      render: (v: string) => <span className={cellCls}>{v || '—'}</span>,
    },
    {
      title: t('table.headers.rejectedOn'),
      dataIndex: 'rejectedOn',
      key: 'rejectedOn',
      render: (v: string) => <span className={cellCls}>{v || '—'}</span>,
    },
    {
      title: t('table.headers.reason'),
      dataIndex: 'rejectionReason',
      key: 'rejectionReason',
      render: (v: string) => (
        <Tooltip title={v} placement="topLeft">
          <span className="block max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium italic text-(--color-text-muted) cursor-default [font-family:var(--font-ui)]">
            {v || '—'}
          </span>
        </Tooltip>
      ),
    },
  ]

  return (
    <div className="approval-queue-table">
      <Table<Application>
        dataSource={data}
        columns={withFixedEnds(columns, { pinLast: false })}
        rowKey="id"
        pagination={false}
        size="middle"
        loading={loading}
        scroll={{ x: 'max-content' }}
        onChange={(_p, filters, sorter) => onQueryParamsChange(mapTableChange(filters, sorter))}
        onRow={(record) => ({
          onClick: () =>
            navigate(`/approval-queue/${record.id}`, {
              state: { fromApproval: true, backLabel: t('common:backTo.approvalQueue') },
            }),
          className: 'cursor-pointer',
        })}
      />
    </div>
  )
}
