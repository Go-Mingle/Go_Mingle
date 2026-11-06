import { Table } from 'antd'
import { withFixedEnds } from '../../../molecules/withFixedEnds'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import type { LogRow } from './changeLogTableHelpers'
import { ACTION_CONFIG, tableSortIcon, funnelIcon, makeSearchFilter } from './changeLogTableHelpers'
import { LabelTag } from '../../../atoms/LabelTag'

const BODY_CELL: React.CSSProperties = {
  fontFamily: 'Poppins, sans-serif',
  fontSize: 14,
  fontWeight: 500,
}

interface ChangeLogTableProps {
  pagedData: LogRow[]
  onTableChange: (
    _p: unknown,
    _f: unknown,
    _s: unknown,
    extra: { currentDataSource: LogRow[] },
  ) => void
}

export function ChangeLogTable({ pagedData, onTableChange }: ChangeLogTableProps) {
  const { t } = useTranslation('change-log')
  const columns: ColumnsType<LogRow> = [
    {
      title: t('table.headers.timestamp'),
      dataIndex: 'timestamp',
      key: 'timestamp',
      align: 'left',
      sorter: (a, b) => (a.timestamp as string).localeCompare(b.timestamp as string),
      sortIcon: tableSortIcon,
      ...makeSearchFilter(t('table.search.timestamp'), 'timestamp'),
      render: (v: string) => (
        <span style={{ ...BODY_CELL, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
          {v}
        </span>
      ),
    },
    {
      title: t('table.headers.admin'),
      dataIndex: 'admin',
      key: 'admin',
      align: 'left',
      sorter: (a, b) => (a.admin as string).localeCompare(b.admin as string),
      sortIcon: tableSortIcon,
      ...makeSearchFilter(t('table.search.user'), 'admin'),
      render: (v: string) => <span style={{ ...BODY_CELL, color: 'var(--color-text)' }}>{v}</span>,
    },
    {
      title: t('table.headers.module'),
      dataIndex: 'module',
      key: 'module',
      align: 'left',
      sorter: (a, b) => (a.module as string).localeCompare(b.module as string),
      sortIcon: tableSortIcon,
      filters: [
        { text: 'Categories', value: 'Categories' },
        { text: 'Approval Queue', value: 'Approval Queue' },
        { text: 'Restaurants', value: 'Restaurants' },
        { text: 'Roles & Access', value: 'Roles & Access' },
        { text: 'Loyalty', value: 'Loyalty' },
        { text: 'Minglers', value: 'Minglers' },
        { text: 'Users', value: 'Users' },
      ],
      filterIcon: funnelIcon,
      onFilter: (value, record) => record.module === value,
      render: (v: string) => <LabelTag>{v}</LabelTag>,
    },
    {
      title: t('table.headers.action'),
      dataIndex: 'action',
      key: 'action',
      align: 'left',
      width: 100,
      sorter: (a, b) => (a.action as string).localeCompare(b.action as string),
      sortIcon: tableSortIcon,
      filters: [
        { text: t('filters.create'), value: 'create' },
        { text: t('filters.update'), value: 'update' },
        { text: t('filters.delete'), value: 'delete' },
      ],
      filterIcon: funnelIcon,
      onFilter: (value, record) => record.action === value,
      render: (v: string) => {
        const cfg = ACTION_CONFIG[v] ?? ACTION_CONFIG.update
        return <LabelTag>{cfg.label}</LabelTag>
      },
    },
    {
      title: t('table.headers.old'),
      dataIndex: 'oldVal',
      key: 'oldVal',
      align: 'left',
      sorter: (a, b) => (a.oldVal as string).localeCompare(b.oldVal as string),
      sortIcon: tableSortIcon,
      ...makeSearchFilter(t('table.search.oldVal'), 'oldVal'),
      render: (v: string, row: LogRow) => {
        const isEmpty = !v || v === '—' || v === null
        if (isEmpty || (row.action as string) === 'create') {
          return <span style={{ ...BODY_CELL, color: 'var(--color-text-muted)' }}>—</span>
        }
        return <span style={{ ...BODY_CELL, color: 'var(--color-text-secondary)' }}>{v}</span>
      },
    },
    {
      title: t('table.headers.new'),
      dataIndex: 'newVal',
      key: 'newVal',
      align: 'left',
      sorter: (a, b) => (a.newVal as string).localeCompare(b.newVal as string),
      sortIcon: tableSortIcon,
      ...makeSearchFilter(t('table.search.newVal'), 'newVal'),
      render: (v: string, row: LogRow) => {
        const isEmpty = !v || v === '—' || v === null
        if (isEmpty || (row.action as string) === 'delete') {
          return <span style={{ ...BODY_CELL, color: 'var(--color-text-muted)' }}>—</span>
        }
        return <LabelTag>{v}</LabelTag>
      },
    },
  ]

  return (
    <div className="change-log-table">
      <Table<LogRow>
        dataSource={pagedData}
        columns={withFixedEnds(columns, { pinLast: false })}
        rowKey="id"
        size="middle"
        pagination={false}
        scroll={{ x: 'max-content' }}
        onChange={onTableChange}
      />
    </div>
  )
}
