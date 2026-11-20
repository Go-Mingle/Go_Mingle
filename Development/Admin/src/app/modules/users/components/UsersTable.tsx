import { Table } from 'antd'
import { withFixedEnds } from '../../../molecules/withFixedEnds'
import type { ColumnsType } from 'antd/es/table'
import { Funnel, ShieldCheck } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { UserRow } from './types'
import type { ListUsersQueryParams } from '../types'
import { tableSortIcon, searchFilterDropdown, searchFilterIcon } from './tableHelpers'
import { UserActionCell } from './UserActionCell'
import { RoleName } from './RoleName'
import type { TableRowSelection } from 'antd/es/table/interface'
import { inSelectionCell } from '../../../hooks/useRowSelection'
import { formatKarachiDateTime } from '../../../../shared/utils/dateHelpers'

type SorterResult = {
  field?: string | string[]
  order?: 'ascend' | 'descend' | null
  column?: unknown
  columnKey?: string | number
}

interface UsersTableProps {
  data: UserRow[]
  loading?: boolean
  onEdit: (row: UserRow) => void
  onResetPassword: (row: UserRow) => void
  onDelete: (row: UserRow) => void
  onQueryParamsChange: (params: Partial<ListUsersQueryParams>) => void
  roleFilterOptions?: { text: string; value: string }[]
  onRowClick?: (user: UserRow) => void
  rowSelection?: TableRowSelection<UserRow>
}

export function UsersTable({
  data,
  loading,
  onEdit,
  onResetPassword,
  onDelete,
  onQueryParamsChange,
  roleFilterOptions = [],
  onRowClick,
  rowSelection,
}: UsersTableProps) {
  const { t } = useTranslation('users')

  const columns: ColumnsType<UserRow> = [
    {
      title: t('table.headers.name'),
      dataIndex: 'fullName',
      key: 'fullName',
      align: 'left',
      sorter: () => 0,
      sortIcon: tableSortIcon,
      filterDropdown: searchFilterDropdown(t('table.searchNameOrEmail')),
      filterIcon: searchFilterIcon,
      render: (v: string) => <span className="text-sm font-medium text-(--color-text)">{v}</span>,
    },
    {
      title: t('table.headers.role'),
      dataIndex: 'role',
      key: 'role',
      align: 'left',
      sorter: () => 0,
      sortIcon: tableSortIcon,
      filters: roleFilterOptions,
      filterIcon: (filtered: boolean) => (
        <Funnel
          size={14}
          weight={filtered ? 'fill' : 'regular'}
          className={filtered ? 'text-(--color-accent)' : 'text-(--color-text-subtle)'}
        />
      ),
      render: (v: { name: string | null }) => <RoleName name={v.name} />,
    },
    {
      title: t('table.headers.lastActive'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      align: 'left',
      sorter: () => 0,
      sortIcon: tableSortIcon,
      render: (v: string) => (
        <span className="text-sm font-medium text-(--color-text-muted)">
          {v ? formatKarachiDateTime(v) : '—'}
        </span>
      ),
    },
    {
      title: t('table.headers.status'),
      dataIndex: 'status',
      key: 'status',
      align: 'left',
      sorter: () => 0,
      sortIcon: tableSortIcon,
      filters: [
        { text: t('table.filterActive'), value: 'ACTIVE' },
        { text: t('table.filterSuspended'), value: 'SUSPENDED' },
      ],
      filterIcon: (filtered: boolean) => (
        <Funnel
          size={14}
          weight={filtered ? 'fill' : 'regular'}
          className={filtered ? 'text-(--color-accent)' : 'text-(--color-text-subtle)'}
        />
      ),
      render: (v: string) => {
        const isActive = v === 'ACTIVE'
        const isSuspended = v === 'SUSPENDED'
        const label = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()
        return (
          <span
            className={`inline-flex items-center h-6 px-[10px] rounded text-xs font-semibold whitespace-nowrap text-white ${
              isActive
                ? 'bg-(--color-success)'
                : isSuspended
                  ? 'bg-(--color-error)'
                  : 'bg-(--color-text-secondary)'
            }`}
          >
            {label}
          </span>
        )
      },
    },
    {
      title: t('table.headers.twoStep'),
      dataIndex: 'twoStepEnabled',
      key: 'twoStepEnabled',
      align: 'left',
      render: (on: boolean | undefined) => (
        <span
          className={`inline-flex items-center gap-1 text-[13px] font-medium ${
            on ? 'text-(--color-success)' : 'text-(--color-text-subtle)'
          }`}
          data-testid="user-two-step"
        >
          {on ? <ShieldCheck size={14} weight="fill" aria-hidden /> : null}
          {on ? t('twoStep.on') : t('twoStep.off')}
        </span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 142,
      align: 'center',
      render: (_: unknown, row: UserRow) => (
        <UserActionCell
          onEdit={() => onEdit(row)}
          onResetPassword={() => onResetPassword(row)}
          onDelete={() => onDelete(row)}
        />
      ),
    },
  ]

  return (
    <div className="users-table">
      <Table<UserRow>
        dataSource={data}
        columns={withFixedEnds(columns)}
        rowKey="id"
        size="middle"
        pagination={false}
        loading={loading}
        scroll={{ x: 'max-content' }}
        onChange={(_p, filters, sorter) => {
          const partial: Partial<ListUsersQueryParams> = {}

          const qValues = filters['fullName']
          partial.q = qValues && qValues.length > 0 ? String(qValues[0]) : undefined

          const roleValues = filters['role']
          partial.roleIds =
            roleValues && roleValues.length > 0 ? (roleValues as string[]).join(',') : undefined

          const statusValues = filters['status']
          partial.statuses =
            statusValues && statusValues.length > 0
              ? (statusValues as string[]).join(',')
              : undefined

          const s = sorter as SorterResult
          if (!Array.isArray(s) && s.field) {
            const fieldMap: Record<string, ListUsersQueryParams['sortBy']> = {
              fullName: 'name',
              role: 'role',
              status: 'status',
            }
            partial.sortBy = fieldMap[s.field as string]
            partial.sortOrder = s.order === 'descend' ? 'desc' : 'asc'
          }

          onQueryParamsChange(partial)
        }}
        rowSelection={rowSelection}
        rowClassName={() => (onRowClick ? 'cursor-pointer' : '')}
        onRow={(record) => ({
          onClick: (e) => {
            if (
              !(e.target as Element).closest('[data-user-action]') &&
              !inSelectionCell(e.target)
            ) {
              onRowClick?.(record)
            }
          },
        })}
      />
    </div>
  )
}
