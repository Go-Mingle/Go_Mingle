import { Table, Tooltip } from 'antd'
import { withFixedEnds } from '../../../molecules/withFixedEnds'
import { CheckCircle, XCircle } from '@phosphor-icons/react'
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
import { ActionIcon } from './ActionIcon'

interface PendingTableProps {
  data: Application[]
  loading?: boolean
  onQueryParamsChange: (params: Partial<ListApprovalsQueryParams>) => void
  onApprove: (record: Application) => void
  onReject: (record: Application) => void
}

const cellCls = 'text-sm font-medium text-(--color-text-secondary) [font-family:var(--font-ui)]'

export function PendingTable({
  data,
  loading,
  onQueryParamsChange,
  onApprove,
  onReject,
}: PendingTableProps) {
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
      render: (v: string) => <span className={cellCls}>{v}</span>,
    },
    {
      title: t('table.headers.phone'),
      dataIndex: 'phone',
      key: 'phone',
      render: (v: string) => <span className={cellCls}>{v || '—'}</span>,
    },
    {
      title: t('table.headers.email'),
      dataIndex: 'email',
      key: 'email',
      render: (v: string) => <span className={cellCls}>{v || '—'}</span>,
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
      title: '',
      key: 'actions',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: Application) => (
        <div className="flex items-center justify-center gap-1">
          <Tooltip title={t('actions.approve')} placement="top">
            <ActionIcon
              hoverBg="var(--color-success-bg)"
              hoverColor="var(--color-success)"
              onClick={(e) => {
                e.stopPropagation()
                onApprove(record)
              }}
            >
              <CheckCircle size={17} weight="regular" />
            </ActionIcon>
          </Tooltip>
          <Tooltip title={t('actions.reject')} placement="top">
            <ActionIcon
              hoverBg="var(--color-error-bg)"
              hoverColor="var(--color-error)"
              onClick={(e) => {
                e.stopPropagation()
                onReject(record)
              }}
            >
              <XCircle size={17} weight="regular" />
            </ActionIcon>
          </Tooltip>
        </div>
      ),
    },
  ]

  return (
    <div className="approval-queue-table">
      <Table<Application>
        dataSource={data}
        columns={withFixedEnds(columns)}
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
