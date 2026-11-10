import { useState } from 'react'
import { Spin, Alert, Pagination, Grid } from 'antd'
import { DownloadSimple } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { ChangeLogTable } from './components/ChangeLogTable'
import { ChangeLogPagination } from './components/ChangeLogPagination'
import type { LogRow } from './components/changeLogTableHelpers'
import { exportToCsv } from '../../../shared/utils/csvExport'
import { HttpError } from '../../../shared/api/httpClient'
import { useChangeLogQuery } from './hooks/useChangeLogQuery'
import { LabelTag } from '../../atoms/LabelTag'
import { AppButton } from '../../atoms/AppButton'

// ── Action badge config ───────────────────────────────────────
// Solid fill + white text — consistent with the restaurant listing tags.
const ACTION_BADGE: Record<string, { bg: string; color: string; actionKey: string }> = {
  create: { bg: '#1565C0', color: '#ffffff', actionKey: 'create' },
  update: { bg: '#B06000', color: '#ffffff', actionKey: 'update' },
  delete: { bg: '#C0392B', color: '#ffffff', actionKey: 'delete' },
}

// ── shared card styles ────────────────────────────────────────
const CARD_STYLE: React.CSSProperties = {
  background: 'var(--color-card)',
  borderRadius: 12,
  boxShadow: 'var(--shadow-sm)',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--color-text-subtle)',
  fontFamily: 'Poppins, sans-serif',
  marginBottom: 3,
}

const VALUE_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 400,
  fontFamily: 'Poppins, sans-serif',
}

// ── ChangeLogCardList ─────────────────────────────────────────
interface ChangeLogCardListProps {
  data: LogRow[]
}

function ChangeLogCardList({ data }: ChangeLogCardListProps) {
  const { t } = useTranslation('change-log')
  return (
    <div className="change-log-card-list">
      {data.map((row, idx) => {
        const action = String(row.action ?? '').toLowerCase()
        const module = row.module as string
        const admin = String(row.admin ?? '')
        const timestamp = row.timestamp as string
        const dataField = row.data as string
        const oldVal = row.oldVal !== undefined ? String(row.oldVal) : '—'
        const newVal = row.newVal !== undefined ? String(row.newVal) : '—'

        const badge = ACTION_BADGE[action] ?? {
          bg: 'var(--tint-neutral-bg)',
          color: 'var(--color-text-secondary)',
          actionKey: action,
        }
        const formattedTime = timestamp ? dayjs(timestamp).format('DD MMM YYYY · HH:mm') : '—'

        return (
          <div key={(row.id as string) ?? idx} style={CARD_STYLE}>
            {/* Row 1: action badge + module */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <LabelTag style={{ flexShrink: 0 }}>{t(`actions.${badge.actionKey}`)}</LabelTag>
              <LabelTag style={{ flexShrink: 0 }} title={module}>
                {module}
              </LabelTag>
            </div>

            {/* Row 2: username + timestamp */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'Poppins, sans-serif',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {admin}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                  fontFamily: 'Poppins, sans-serif',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {formattedTime}
              </span>
            </div>

            {/* Row 3: target / data */}
            <div style={{ minWidth: 0 }}>
              <div style={LABEL_STYLE}>{t('table.headers.target')}</div>
              <div
                style={{
                  ...VALUE_STYLE,
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  wordBreak: 'break-word',
                }}
              >
                {dataField ?? '—'}
              </div>
            </div>

            {/* Row 4: old + new */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                paddingTop: 8,
                borderTop: '1px solid var(--color-divider)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={LABEL_STYLE}>{t('table.headers.old')}</div>
                {oldVal === '—' ? (
                  <span style={{ ...VALUE_STYLE, color: 'var(--color-text-subtle)' }}>—</span>
                ) : (
                  <div
                    style={{
                      ...VALUE_STYLE,
                      color: 'var(--color-text-muted)',
                      borderLeft: '2px solid var(--color-border-strong)',
                      paddingLeft: 8,
                      wordBreak: 'break-word',
                    }}
                  >
                    {oldVal}
                  </div>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={LABEL_STYLE}>{t('table.headers.new')}</div>
                {newVal === '—' ? (
                  <span style={{ ...VALUE_STYLE, color: 'var(--color-text-subtle)' }}>—</span>
                ) : (
                  <div
                    style={{
                      ...VALUE_STYLE,
                      color: 'var(--color-text-secondary)',
                      borderLeft: '2px solid var(--color-border-strong)',
                      paddingLeft: 8,
                      wordBreak: 'break-word',
                    }}
                  >
                    {newVal}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export function ChangeLogPage() {
  const { t } = useTranslation('change-log')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [tableFiltered, setTableFiltered] = useState<LogRow[] | null>(null)

  const { data: logs = [], isPending, isError, error } = useChangeLogQuery()

  const allLogs = logs as LogRow[]
  const displayData = tableFiltered ?? allLogs
  const total = displayData.length
  // A-11 — the audit read API is not deployed on every environment. A 404 is a
  // missing service, not a transient fetch failure, and must not be reported as
  // one: an operator who sees "try again" assumes the log is empty, not absent.
  const isAuditApiMissing = isError && error instanceof HttpError && error.status === 404
  const startRecord = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, total)
  const pagedData = displayData.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleTableChange = (
    _p: unknown,
    _f: unknown,
    _s: unknown,
    extra: { currentDataSource: LogRow[] },
  ) => {
    setTableFiltered(extra.currentDataSource)
    setCurrentPage(1)
  }

  const handleExportCsv = () => {
    exportToCsv('change-log.csv', displayData as unknown as Record<string, unknown>[], [
      { key: 'timestamp', header: 'Timestamp' },
      { key: 'admin', header: 'User' },
      { key: 'action', header: 'Action' },
      { key: 'module', header: 'Module' },
      { key: 'data', header: 'Data' },
      { key: 'oldVal', header: 'Old Value' },
      { key: 'newVal', header: 'New Value' },
    ])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          gap: 12,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: isMobile ? 20 : 26,
            fontWeight: 700,
            color: 'var(--color-text)',
            fontFamily: 'Poppins, sans-serif',
            lineHeight: 1.2,
          }}
        >
          {t('title')}
        </h1>
        <AppButton
          variant="neutral"
          onClick={handleExportCsv}
          disabled={total === 0}
          style={{ flexShrink: 0 }}
        >
          <DownloadSimple size={15} weight="regular" />
          {t('actions.exportCsv')}
        </AppButton>
      </div>

      {isPending ? (
        <Spin className="flex justify-center mt-20" />
      ) : isAuditApiMissing ? (
        <Alert type="warning" message={t('errors.unavailable')} className="m-4" />
      ) : isError ? (
        <Alert type="error" message={t('common:errors.fetchError')} className="m-4" />
      ) : isMobile ? (
        <ChangeLogCardList data={pagedData} />
      ) : (
        <ChangeLogTable pagedData={pagedData} onTableChange={handleTableChange} />
      )}

      {!isPending &&
        !isError &&
        (isMobile ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
            <Pagination
              current={currentPage}
              total={total}
              pageSize={pageSize}
              onChange={(page) => setCurrentPage(page)}
              showSizeChanger={false}
              size="small"
            />
          </div>
        ) : (
          <ChangeLogPagination
            currentPage={currentPage}
            pageSize={pageSize}
            total={total}
            startRecord={startRecord}
            endRecord={endRecord}
            onPageChange={setCurrentPage}
            onPageSizeChange={(val) => {
              setPageSize(val)
              setCurrentPage(1)
            }}
          />
        ))}
    </div>
  )
}
