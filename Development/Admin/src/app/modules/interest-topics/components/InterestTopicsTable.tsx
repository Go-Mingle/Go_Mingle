import React from 'react'
import { withFixedEnds } from '../../../molecules/withFixedEnds'
import { Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { FilterValue } from 'antd/es/table/interface'
import {
  PencilSimple,
  Trash,
  ArrowUp,
  ArrowDown,
  ArrowsDownUp,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { TableColumnSearchFilter } from '../../../../shared/components/TableColumnSearchFilter'
import { LabelTag } from '../../../atoms/LabelTag'
import { TopicGraphic } from './TopicGraphic'
import type { InterestTopic } from '../types'

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

function SortToggleIcon({ order }: { order: 'asc' | 'desc' | null }) {
  if (order === 'asc') return <ArrowUp size={12} weight="bold" color="var(--color-accent)" />
  if (order === 'desc') return <ArrowDown size={12} weight="bold" color="var(--color-accent)" />
  return <ArrowsDownUp size={12} color="var(--color-text-subtle)" />
}

interface InterestTopicsTableProps {
  pagedData: InterestTopic[]
  sortOrder: 'asc' | 'desc'
  searchValue: string
  onSortToggle: () => void
  onSearchChange: (value: string) => void
  onEdit: (topic: InterestTopic) => void
  onDeleteTarget: (topic: InterestTopic) => void
}

export function InterestTopicsTable({
  pagedData,
  sortOrder,
  searchValue,
  onSortToggle,
  onSearchChange,
  onEdit,
  onDeleteTarget,
}: InterestTopicsTableProps) {
  const { t } = useTranslation('interest-topics')
  const columns: ColumnsType<InterestTopic> = [
    {
      title: (
        <div
          onClick={onSortToggle}
          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          {t('table.headers.topic')}
          <SortToggleIcon order={sortOrder} />
        </div>
      ),
      dataIndex: 'name',
      key: 'name',
      filteredValue: searchValue ? [searchValue] : null,
      filterDropdown: (props) => (
        <TableColumnSearchFilter {...props} placeholder={t('search.placeholder')} />
      ),
      filterIcon: (filtered: boolean) => (
        <MagnifyingGlass
          size={14}
          weight={filtered ? 'fill' : 'regular'}
          color={filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)'}
        />
      ),
      render: (v: string, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TopicGraphic graphicUrl={row.graphicUrl} name={v} />
          <span className="font-semibold text-[var(--color-text)]">{v}</span>
        </div>
      ),
    },
    {
      title: t('table.headers.interests'),
      key: 'interests',
      render: (_: unknown, row) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {row.interests.length === 0 ? (
            <span style={{ color: 'var(--color-text-subtle)', fontSize: 13 }}>—</span>
          ) : (
            row.interests.map((interest) => <LabelTag key={interest.id}>{interest.name}</LabelTag>)
          )}
        </div>
      ),
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
    <div className="interest-topics-table">
      <Table<InterestTopic>
        dataSource={pagedData}
        columns={withFixedEnds(columns)}
        rowKey="id"
        size="middle"
        pagination={false}
        scroll={{ x: 'max-content' }}
        onChange={(_pagination, filters: Record<string, FilterValue | null>) => {
          onSearchChange((filters.name?.[0] as string | undefined) ?? '')
        }}
      />
    </div>
  )
}
