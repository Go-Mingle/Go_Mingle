import { Table } from 'antd'
import { withFixedEnds } from '../../../molecules/withFixedEnds'
import type { ColumnsType, TableProps } from 'antd/es/table'
import { PencilSimple, Trash } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { Role } from './rolesTableHelpers'
import {
  ALL_MODULES,
  tableSortIcon,
  searchFilterDropdown,
  searchFilterIcon,
} from './rolesTableHelpers'
import { RoleActionButton } from './RoleActionButton'
import { LabelTag } from '../../../atoms/LabelTag'
import { ModuleTagList } from './ModuleTagList'

interface RolesTableProps {
  pagedData: Role[]
  sortBy: 'name' | 'usersAssigned' | null
  sortDir: 'asc' | 'desc'
  loading?: boolean
  onEdit: (role: Role) => void
  onDeleteTarget: (role: Role) => void
  onTableChange: TableProps<Role>['onChange']
}

export function RolesTable({
  pagedData,
  sortBy,
  sortDir,
  loading,
  onEdit,
  onDeleteTarget,
  onTableChange,
}: RolesTableProps) {
  const { t } = useTranslation('roles-access')

  const columns: ColumnsType<Role> = [
    {
      title: t('table.headers.roleName'),
      dataIndex: 'name',
      key: 'name',
      align: 'left',
      sorter: true,
      sortOrder: sortBy === 'name' ? (sortDir === 'asc' ? 'ascend' : 'descend') : null,
      sortIcon: tableSortIcon,
      filterDropdown: searchFilterDropdown(t('search.role')),
      filterIcon: searchFilterIcon,
      render: (v: string) => (
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text)',
          }}
        >
          {v}
        </span>
      ),
    },
    {
      title: t('table.headers.modules'),
      dataIndex: 'permissions',
      key: 'permissions',
      align: 'left',
      render: (_: unknown, row) => {
        if (row.fullAccess) {
          return <LabelTag>{t('fullAccessBadge')}</LabelTag>
        }
        const labels = (row.permissions ?? []).map(
          (key: string) => ALL_MODULES.find((m) => m.key === key)?.label ?? key,
        )
        return <ModuleTagList labels={labels} />
      },
    },
    {
      title: t('table.headers.usersAssigned'),
      dataIndex: 'usersAssigned',
      key: 'usersAssigned',
      align: 'left',
      sorter: true,
      sortOrder: sortBy === 'usersAssigned' ? (sortDir === 'asc' ? 'ascend' : 'descend') : null,
      sortIcon: tableSortIcon,
      render: (v: number) => (
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
          }}
        >
          {v}
        </span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_: unknown, row) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <RoleActionButton
            tooltip={t('tooltips.edit')}
            hoverBg="var(--color-accent-light)"
            hoverColor="var(--color-accent)"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(row)
            }}
          >
            <PencilSimple size={17} weight="regular" />
          </RoleActionButton>
          <RoleActionButton
            tooltip={t('tooltips.delete')}
            hoverBg="var(--color-error-bg)"
            hoverColor="var(--color-error)"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteTarget(row)
            }}
          >
            <Trash size={17} weight="regular" />
          </RoleActionButton>
        </div>
      ),
    },
  ]

  return (
    <div className="roles-table">
      <Table<Role>
        dataSource={pagedData}
        columns={withFixedEnds(columns)}
        rowKey="id"
        size="middle"
        pagination={false}
        loading={loading}
        scroll={{ x: 'max-content' }}
        onChange={onTableChange}
      />
    </div>
  )
}
