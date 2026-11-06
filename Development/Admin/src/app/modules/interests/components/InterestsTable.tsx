import React from 'react'
import { withFixedEnds } from '../../../molecules/withFixedEnds'
import { Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PencilSimple,
  Trash,
  ArrowsDownUp,
  ArrowUp,
  ArrowDown,
  Funnel,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { Interest } from '../types'
import { makeSearchFilter } from './interestsTableHelpers'
import { LabelTag } from '../../../atoms/LabelTag'

const funnelIcon = (filtered: boolean) => (
  <Funnel
    size={14}
    weight={filtered ? 'fill' : 'regular'}
    style={{ color: filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}
  />
)

const tableSortIcon = ({ sortOrder }: { sortOrder: 'ascend' | 'descend' | null }) => {
  if (sortOrder === 'ascend') return <ArrowUp size={12} weight="bold" color="var(--color-accent)" />
  if (sortOrder === 'descend')
    return <ArrowDown size={12} weight="bold" color="var(--color-accent)" />
  return <ArrowsDownUp size={12} color="var(--color-text-subtle)" />
}

function ActionIcon({
  children,
  hoverBg,
  hoverColor,
  onClick,
}: {
  children: React.ReactNode
  hoverBg: string
  hoverColor: string
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        cursor: 'pointer',
        transition: 'all 150ms ease-out',
        color: 'var(--color-text-muted)',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverBg
        e.currentTarget.style.color = hoverColor
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--color-text-muted)'
      }}
    >
      {children}
    </div>
  )
}

interface InterestsTableProps {
  pagedData: Interest[]
  categoryOptions: string[]
  onEdit: (interest: Interest) => void
  onDeleteTarget: (interest: Interest) => void
}

export function InterestsTable({
  pagedData,
  categoryOptions,
  onEdit,
  onDeleteTarget,
}: InterestsTableProps) {
  const { t } = useTranslation('interests')
  const columns: ColumnsType<Interest> = [
    {
      title: t('table.headers.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      sortIcon: tableSortIcon,
      ...makeSearchFilter(t('table.search.name'), 'name'),
      render: (v: string) => <span className="font-semibold text-[var(--color-text)]">{v}</span>,
    },
    {
      title: t('table.headers.category'),
      dataIndex: 'groupName',
      key: 'groupName',
      sorter: (a, b) => a.groupName.localeCompare(b.groupName),
      sortIcon: tableSortIcon,
      filters: categoryOptions.map((c) => ({ text: c, value: c })),
      filterIcon: funnelIcon,
      onFilter: (value, record) => record.groupName === value,
      render: (v: string) => <LabelTag>{v}</LabelTag>,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, row) => (
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          onClick={(e) => e.stopPropagation()}
        >
          <ActionIcon
            hoverBg="var(--color-accent-light)"
            hoverColor="var(--color-accent)"
            onClick={() => onEdit(row)}
          >
            <PencilSimple size={17} weight="regular" />
          </ActionIcon>
          <ActionIcon
            hoverBg="var(--color-error-bg)"
            hoverColor="var(--color-error)"
            onClick={() => onDeleteTarget(row)}
          >
            <Trash size={17} weight="regular" />
          </ActionIcon>
        </div>
      ),
    },
  ]

  return (
    <div className="interests-table">
      <Table<Interest>
        dataSource={pagedData}
        columns={withFixedEnds(columns)}
        rowKey="id"
        size="middle"
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}
