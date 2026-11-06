import React from 'react'
import { withFixedEnds } from '../../../molecules/withFixedEnds'
import { Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Trash, ArrowsDownUp, ArrowUp, ArrowDown, PencilSimple } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { Category } from './categoriesTableHelpers'
import { makeSearchFilter } from './categoriesTableHelpers'

const tableSortIcon = ({ sortOrder }: { sortOrder: 'ascend' | 'descend' | null }) => {
  if (sortOrder === 'ascend') return <ArrowUp size={12} weight="bold" color="var(--color-accent)" />
  if (sortOrder === 'descend')
    return <ArrowDown size={12} weight="bold" color="var(--color-accent)" />
  return <ArrowsDownUp size={12} color="var(--color-text-subtle)" />
}

function ActionIcon({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode
  className: string
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      role="button"
      onClick={onClick}
      className={`w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer text-[var(--color-text-muted)] transition-all duration-150 ease-out ${className}`}
    >
      {children}
    </div>
  )
}

interface CategoriesTableProps {
  pagedData: Category[]
  onEdit: (cat: Category) => void
  onDeleteTarget: (cat: Category) => void
}

export function CategoriesTable({ pagedData, onEdit, onDeleteTarget }: CategoriesTableProps) {
  const { t } = useTranslation('categories')
  const columns: ColumnsType<Category> = [
    {
      title: t('table.headers.category'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      sortIcon: tableSortIcon,
      ...makeSearchFilter(t('table.search.categories'), 'name'),
      render: (v: string) => <span className="font-semibold text-[var(--color-text)]">{v}</span>,
    },
    {
      title: t('table.headers.commissionPercent'),
      dataIndex: 'commissionRate',
      key: 'commissionRate',
      sorter: (a, b) => a.commissionRate - b.commissionRate,
      sortIcon: tableSortIcon,
      render: (v: number) => (
        <span className="text-sm font-medium text-[var(--color-text-secondary)] [font-family:Poppins,sans-serif]">
          {v}%
        </span>
      ),
    },
    {
      title: t('table.headers.restaurants'),
      dataIndex: 'restaurantsCount',
      key: 'restaurantsCount',
      sorter: (a, b) => a.restaurantsCount - b.restaurantsCount,
      sortIcon: tableSortIcon,
      render: (v: number) => <span className="text-[var(--color-text-muted)]">{v}</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 88,
      align: 'center' as const,
      render: (_: unknown, row) => (
        <div
          className="flex items-center justify-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip title={t('tooltips.edit')}>
            <ActionIcon
              className="hover:bg-(--color-accent-light) hover:text-accent"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(row)
              }}
            >
              <PencilSimple size={16} weight="regular" />
            </ActionIcon>
          </Tooltip>
          <Tooltip title={t('tooltips.delete')}>
            <ActionIcon
              className="hover:bg-(--color-error-bg) hover:text-(--color-error)"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteTarget(row)
              }}
            >
              <Trash size={17} weight="regular" />
            </ActionIcon>
          </Tooltip>
        </div>
      ),
    },
  ]

  return (
    <div className="restaurants-table">
      <Table<Category>
        dataSource={pagedData}
        columns={withFixedEnds(columns)}
        rowKey="id"
        size="middle"
        pagination={false}
        scroll={{ x: 'max-content' }}
        onRow={(record) => ({
          onClick: () => onEdit(record),
          className: 'cursor-pointer',
        })}
      />
    </div>
  )
}
