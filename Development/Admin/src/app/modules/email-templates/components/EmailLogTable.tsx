import { Alert, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { formatWhen } from '../formatWhen'
import type { EmailLogEntry, EmailLogStatus } from '../types'

const STATUS_CLS: Record<EmailLogStatus, string> = {
  SENT: 'bg-(--color-success-bg) text-(--color-success)',
  FAILED: 'bg-(--color-error-bg) text-(--color-error)',
  LOGGED: 'bg-(--color-warning-bg) text-(--color-warning)',
  SKIPPED: 'bg-(--color-divider) text-(--color-text-muted)',
}

interface EmailLogTableProps {
  entries: EmailLogEntry[]
  loading: boolean
  error: boolean
}

export function EmailLogTable({ entries, loading, error }: Readonly<EmailLogTableProps>) {
  const { t } = useTranslation('email-templates')

  if (error) return <Alert type="error" message={t('messages.logError')} />

  const hintFor = (row: EmailLogEntry) =>
    row.status === 'FAILED'
      ? row.error
      : row.status === 'LOGGED'
        ? t('log.loggedHint')
        : row.status === 'SKIPPED'
          ? t('log.skippedHint')
          : null

  const columns: ColumnsType<EmailLogEntry> = [
    {
      title: t('log.when'),
      dataIndex: 'createdAt',
      width: 190,
      render: (v: string) => <span className="whitespace-nowrap">{formatWhen(v)}</span>,
    },
    { title: t('log.email'), dataIndex: 'templateName', width: 200 },
    {
      title: t('log.to'),
      dataIndex: 'to',
      width: 220,
      render: (v: string) => <span className="break-all">{v}</span>,
    },
    { title: t('log.subject'), dataIndex: 'subject', ellipsis: true },
    {
      title: t('log.status'),
      dataIndex: 'status',
      width: 140,
      render: (_: EmailLogStatus, row) => (
        <Tooltip title={hintFor(row)}>
          <span
            className={clsx(
              'inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
              STATUS_CLS[row.status],
            )}
          >
            {t(`log.statuses.${row.status}`)}
          </span>
        </Tooltip>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[13px] text-(--color-text-muted)">{t('log.hint')}</p>
      <Table<EmailLogEntry>
        rowKey="id"
        size="middle"
        columns={columns}
        dataSource={entries}
        loading={loading}
        pagination={false}
        scroll={{ x: 900 }}
        locale={{ emptyText: t('log.empty') }}
      />
    </div>
  )
}
