import { Avatar } from 'antd'
import {
  PencilSimple as Pencil,
  Trash as Trash2,
  ArrowsDownUp,
  ArrowUp,
  ArrowDown,
  Funnel,
} from '@phosphor-icons/react'
import { StatusBadge } from '../../atoms/StatusBadge'
import type { StatusVariant } from '../../atoms/StatusBadge'
import i18n from '../../../locales/i18n'

type UserRow = Record<string, unknown>

interface ColumnCallbacks {
  onEdit: (row: UserRow) => void
  onDelete: (row: UserRow) => void
}

const tableSortIcon = ({ sortOrder }: { sortOrder: 'ascend' | 'descend' | null }) => {
  if (sortOrder === 'ascend') return <ArrowUp size={12} weight="bold" color="var(--color-accent)" />
  if (sortOrder === 'descend')
    return <ArrowDown size={12} weight="bold" color="var(--color-accent)" />
  return <ArrowsDownUp size={12} color="var(--color-text-subtle)" />
}

const funnelIcon = (filtered: boolean) => (
  <Funnel
    size={14}
    weight={filtered ? 'fill' : 'regular'}
    style={{ color: filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}
  />
)

export function buildUserColumns({ onEdit, onDelete }: ColumnCallbacks) {
  const t = i18n.t.bind(i18n)

  return [
    {
      title: t('users:table.headers.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a: UserRow, b: UserRow) => (a.name as string).localeCompare(b.name as string),
      sortIcon: tableSortIcon,
      render: (v: string, row: UserRow) => (
        <div className="flex items-center gap-2">
          <Avatar
            size={28}
            style={{
              backgroundColor: 'var(--color-accent)',
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {row.initials as string}
          </Avatar>
          <span className="text-[13px] font-medium text-[var(--color-text)]">{v}</span>
        </div>
      ),
    },
    {
      title: t('users:table.headers.role'),
      dataIndex: 'role',
      key: 'role',
      filters: [
        { text: t('users:roles.superAdmin'), value: 'Super Admin' },
        { text: t('users:roles.operationsManager'), value: 'Operations Manager' },
        { text: t('users:roles.financeManager'), value: 'Finance Manager' },
        { text: t('users:roles.contentReviewer'), value: 'Content Reviewer' },
      ],
      filterIcon: funnelIcon,
      onFilter: (value: unknown, record: UserRow) => record.role === value,
      render: (v: string) => (
        <span className="text-[13px] text-[var(--color-text-muted)]">{v}</span>
      ),
    },
    {
      title: t('users:table.headers.status'),
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: t('users:table.filterActive'), value: 'ACTIVE' },
        { text: t('users:table.filterSuspended'), value: 'SUSPENDED' },
      ],
      filterIcon: funnelIcon,
      onFilter: (value: unknown, record: UserRow) => record.status === value,
      render: (v: string) => <StatusBadge variant={v as StatusVariant} />,
    },
    {
      title: t('users:table.headers.lastActive'),
      dataIndex: 'lastActive',
      key: 'lastActive',
      sorter: (a: UserRow, b: UserRow) =>
        (a.lastActive as string).localeCompare(b.lastActive as string),
      sortIcon: tableSortIcon,
      render: (v: string) => (
        <span className="font-[var(--font-mono)] text-[12px] text-[var(--color-text-muted)]">
          {v}
        </span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_: unknown, row: UserRow) => (
        <div className="flex items-center gap-3">
          <button
            onClick={() => onEdit(row)}
            className="flex items-center gap-1 text-[var(--color-accent)] text-[12px] font-medium bg-transparent border-none cursor-pointer"
          >
            <Pencil size={14} /> {t('users:actions.edit')}
          </button>
          <button
            onClick={() => onDelete(row)}
            className="text-[var(--color-error)] bg-transparent border-none cursor-pointer"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]
}
