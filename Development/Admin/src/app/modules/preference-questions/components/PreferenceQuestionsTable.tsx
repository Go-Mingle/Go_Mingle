import { type ReactNode, type MouseEvent } from 'react'
import { withFixedEnds } from '../../../molecules/withFixedEnds'
import { Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { FilterValue } from 'antd/es/table/interface'
import {
  Trash,
  ArrowsDownUp,
  ArrowUp,
  ArrowDown,
  MagnifyingGlass,
  PencilSimple,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { TableColumnSearchFilter } from '../../../../shared/components/TableColumnSearchFilter'
import type { PreferenceQuestionListItem } from '../types'
import { LabelTag } from '../../../atoms/LabelTag'

interface PreferenceQuestionsTableProps {
  pagedData: PreferenceQuestionListItem[]
  sortBy: 'order' | 'question'
  sortOrder: 'asc' | 'desc'
  searchValue: string
  onSort: (by: 'order' | 'question', dir: 'asc' | 'desc') => void
  onRowClick: (q: PreferenceQuestionListItem) => void
  onDeleteTarget: (q: PreferenceQuestionListItem) => void
  onSearch: (q: string) => void
  emptyText: string
  loading?: boolean
}

function SortableHeader({
  label,
  column,
  sortBy,
  sortOrder,
  onSort,
}: {
  label: string
  column: 'order' | 'question'
  sortBy: 'order' | 'question'
  sortOrder: 'asc' | 'desc'
  onSort: (by: 'order' | 'question', dir: 'asc' | 'desc') => void
}) {
  const isActive = sortBy === column
  const nextDir = isActive && sortOrder === 'asc' ? 'desc' : 'asc'
  const SortIcon = isActive ? (sortOrder === 'asc' ? ArrowUp : ArrowDown) : ArrowsDownUp

  return (
    <div
      className="flex items-center gap-1 cursor-pointer select-none"
      onClick={() => onSort(column, nextDir)}
    >
      <span>{label}</span>
      <SortIcon
        size={12}
        weight={isActive ? 'bold' : 'regular'}
        color={isActive ? 'var(--color-accent)' : 'var(--color-text-subtle)'}
      />
    </div>
  )
}

function ActionIcon({
  children,
  hoverClass,
  onClick,
}: {
  children: ReactNode
  hoverClass: string
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      role="button"
      onClick={onClick}
      className={`w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer text-(--color-text-muted) transition-all duration-150 ease-out ${hoverClass}`}
    >
      {children}
    </div>
  )
}

export function PreferenceQuestionsTable({
  pagedData,
  sortBy,
  sortOrder,
  searchValue,
  onSort,
  onRowClick,
  onDeleteTarget,
  onSearch,
  emptyText,
  loading,
}: PreferenceQuestionsTableProps) {
  const { t } = useTranslation('preference-questions')

  const columns: ColumnsType<PreferenceQuestionListItem> = [
    {
      title: (
        <SortableHeader
          label={t('table.headers.order')}
          column="order"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
        />
      ),
      dataIndex: 'questionOrder',
      key: 'order',
      width: 100,
      align: 'left' as const,
      render: (v: number) => (
        <span className="font-[Poppins,sans-serif] text-sm font-semibold text-(--color-text)">
          {v}
        </span>
      ),
    },
    {
      title: (
        <SortableHeader
          label={t('table.headers.question')}
          column="question"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
        />
      ),
      dataIndex: 'question',
      key: 'question',
      filteredValue: searchValue ? [searchValue] : null,
      filterDropdown: (props) => (
        <TableColumnSearchFilter {...props} placeholder={t('table.search.question')} />
      ),
      filterIcon: (filtered: boolean) => (
        <MagnifyingGlass
          size={14}
          weight={filtered ? 'fill' : 'regular'}
          color={filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)'}
        />
      ),
      render: (v: string) => (
        <span className="font-[Poppins,sans-serif] text-sm font-medium text-(--color-text)">
          {v}
        </span>
      ),
    },
    {
      title: t('table.headers.type'),
      dataIndex: 'type',
      key: 'type',
      width: 160,
      render: (v: 'SINGLE_SELECT' | 'MULTI_SELECT') => (
        <LabelTag>{v === 'SINGLE_SELECT' ? t('type.single') : t('type.multi')}</LabelTag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 96,
      align: 'center' as const,
      render: (_: unknown, row) => (
        <div
          className="flex items-center justify-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip title={t('tooltips.edit')}>
            <ActionIcon
              hoverClass="hover:bg-(--color-accent-light) hover:text-(--color-accent)"
              onClick={(e) => {
                e.stopPropagation()
                onRowClick(row)
              }}
            >
              <PencilSimple size={16} weight="regular" />
            </ActionIcon>
          </Tooltip>
          <Tooltip title={t('tooltips.delete')}>
            <ActionIcon
              hoverClass="hover:bg-(--color-error-bg) hover:text-(--color-error)"
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
    <div className="preference-questions-table">
      <Table<PreferenceQuestionListItem>
        dataSource={pagedData}
        columns={withFixedEnds(columns, { firstWidth: 96 })}
        rowKey="id"
        size="middle"
        pagination={false}
        loading={loading}
        locale={{ emptyText }}
        scroll={{ x: 'max-content' }}
        onChange={(_pagination, filters: Record<string, FilterValue | null>) => {
          onSearch((filters.question?.[0] as string | undefined) ?? '')
        }}
        onRow={(record) => ({
          onClick: () => onRowClick(record),
          className: 'cursor-pointer',
        })}
      />
    </div>
  )
}
