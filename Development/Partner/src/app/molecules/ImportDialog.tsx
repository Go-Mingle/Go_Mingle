import { useMemo, useState } from 'react'
import { Alert, Modal, Progress, Table, Tag, Upload } from 'antd'
import { DownloadSimple, FileArrowUp } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../atoms/AppButton'
import { PrimaryActionButton, SecondaryActionButton } from '../atoms/ModalActions'
import {
  IMPORT_ACCEPT,
  IMPORT_MAX_ROWS,
  SpreadsheetError,
  downloadCsv,
  mapRows,
  readSheet,
  type ImportColumn,
} from '../../shared/utils/spreadsheet'

type Step = 'pick' | 'preview' | 'running' | 'done'

export interface ImportRowResult {
  row: number
  error: string
}

export interface ImportDialogProps<K extends string> {
  open: boolean
  onClose: () => void
  /** Called after an import that added at least one row, so the list can reload. */
  onImported: (count: number) => void
  title: string
  intro: React.ReactNode
  columns: (ImportColumn<K> & { label: string; example: string })[]
  templateFileName: string
  /** Returns the problem with a row, or null when it is ready to import. `seen` is shared across rows to catch duplicates. */
  validate: (rec: Record<K, string>, seen: Set<string>) => string | null
  /** Sends one row; throw to report it as failed with the given message. */
  importRow: (rec: Record<K, string>) => Promise<void>
  /** Extra controls shown above the preview, e.g. a shared temporary password. */
  extra?: React.ReactNode
  /** False while `extra` still needs input. */
  extraReady?: boolean
  errorMessage: (e: unknown) => string
}

interface PreviewRow<K extends string> {
  row: number
  rec: Record<K, string>
  problem: string | null
}

/**
 * Upload an .xlsx or .csv, check every row, then import the ready ones one at a
 * time through the normal endpoints. Rows with problems are skipped and listed.
 */
export function ImportDialog<K extends string>(props: ImportDialogProps<K>) {
  const {
    open,
    onClose,
    onImported,
    title,
    intro,
    columns,
    templateFileName,
    validate,
    importRow,
    extra,
    extraReady = true,
    errorMessage,
  } = props
  const { t } = useTranslation('common')
  const [step, setStep] = useState<Step>('pick')
  const [fileName, setFileName] = useState('')
  const [readError, setReadError] = useState<string | null>(null)
  const [rows, setRows] = useState<PreviewRow<K>[]>([])
  const [done, setDone] = useState(0)
  const [failures, setFailures] = useState<ImportRowResult[]>([])

  const ready = useMemo(() => rows.filter((r) => !r.problem), [rows])
  const skipped = rows.length - ready.length

  const reset = () => {
    setStep('pick')
    setFileName('')
    setReadError(null)
    setRows([])
    setDone(0)
    setFailures([])
  }

  const close = () => {
    if (step === 'running') return
    reset()
    onClose()
  }

  const pick = async (file: File) => {
    setReadError(null)
    try {
      const sheet = await readSheet(file)
      const { records, missing } = mapRows(sheet, columns)
      if (missing.length) {
        const labels = columns.filter((c) => missing.includes(c.key)).map((c) => c.label)
        setReadError(t('import.missingColumns', { columns: labels.join(', ') }))
        return false
      }
      const seen = new Set<string>()
      setRows(records.map((rec, i) => ({ row: i + 2, rec, problem: validate(rec, seen) })))
      setFileName(file.name)
      setStep('preview')
    } catch (e) {
      const reason = e instanceof SpreadsheetError ? e.reason : 'unreadable'
      setReadError(t(`import.errors.${reason}`, { max: IMPORT_MAX_ROWS }))
    }
    return false
  }

  const run = async () => {
    setStep('running')
    const failed: ImportRowResult[] = []
    let ok = 0
    for (const r of ready) {
      try {
        await importRow(r.rec)
        ok++
      } catch (e) {
        failed.push({ row: r.row, error: errorMessage(e) })
      }
      setDone((d) => d + 1)
    }
    setFailures(failed)
    setStep('done')
    if (ok > 0) onImported(ok)
  }

  const template = () =>
    downloadCsv(templateFileName, [columns.map((c) => c.label), columns.map((c) => c.example)])

  const tableColumns = [
    { title: t('import.row'), dataIndex: 'row', width: 64 },
    ...columns.map((c) => ({
      title: c.label,
      key: c.key,
      render: (_: unknown, r: PreviewRow<K>) =>
        r.rec[c.key] || <span className="text-[var(--color-text-muted)]">—</span>,
    })),
    {
      title: t('import.check'),
      key: 'check',
      render: (_: unknown, r: PreviewRow<K>) =>
        r.problem ? (
          <Tag color="error">{r.problem}</Tag>
        ) : (
          <Tag color="success">{t('import.ready')}</Tag>
        ),
    },
  ]

  const total = ready.length
  const imported = done - failures.length

  return (
    <Modal
      open={open}
      onCancel={close}
      title={<span className="text-[20px] font-semibold">{title}</span>}
      footer={null}
      width={step === 'pick' ? 560 : 860}
      destroyOnHidden
      maskClosable={step !== 'running'}
      closable={step !== 'running'}
    >
      {step === 'pick' && (
        <div className="flex flex-col gap-4" data-testid="import-pick">
          <div className="text-[14px] text-[var(--color-text-muted)]">{intro}</div>
          <Upload.Dragger
            accept={IMPORT_ACCEPT}
            showUploadList={false}
            beforeUpload={(f) => pick(f as unknown as File)}
            className="app-upload-dragger"
          >
            <div className="flex flex-col items-center gap-2 py-4">
              <FileArrowUp size={30} className="text-[var(--color-text-subtle)]" aria-hidden />
              <span className="text-[14px] font-semibold text-[var(--color-text)]">
                {t('import.drop')}
              </span>
              <span className="text-[13px] text-[var(--color-text-muted)]">
                {t('import.formats', { max: IMPORT_MAX_ROWS })}
              </span>
            </div>
          </Upload.Dragger>
          {readError && <Alert type="error" showIcon message={readError} />}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-[var(--color-text-muted)]">
              {t('import.columnsHint', {
                columns: columns.map((c) => c.label + (c.required ? ' *' : '')).join(', '),
              })}
            </span>
            <AppButton variant="secondary" onClick={template}>
              <DownloadSimple size={14} /> {t('import.template')}
            </AppButton>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="flex flex-col gap-4" data-testid="import-preview">
          <Alert
            type={skipped ? 'warning' : 'success'}
            showIcon
            message={t('import.summary', { file: fileName, ready: total, skipped })}
          />
          {extra}
          <Table
            rowKey="row"
            size="small"
            columns={tableColumns}
            dataSource={rows}
            pagination={rows.length > 8 ? { pageSize: 8, showSizeChanger: false } : false}
            scroll={{ x: true }}
          />
          <div className="app-modal-footer">
            <SecondaryActionButton onClick={reset}>
              {t('import.chooseAnother')}
            </SecondaryActionButton>
            <PrimaryActionButton onClick={run} disabled={!total || !extraReady}>
              {t('import.importN', { count: total })}
            </PrimaryActionButton>
          </div>
        </div>
      )}

      {step === 'running' && (
        <div className="flex flex-col items-center gap-3 py-6" role="status" aria-live="polite">
          <Progress type="circle" percent={total ? Math.round((done / total) * 100) : 100} />
          <span className="text-[14px]">{t('import.progress', { done, total })}</span>
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col gap-4" data-testid="import-done">
          <Alert
            type={failures.length ? 'warning' : 'success'}
            showIcon
            message={t('import.result', { imported, failed: failures.length, skipped })}
          />
          {failures.length > 0 && (
            <ul className="m-0 flex max-h-[220px] flex-col gap-1 overflow-auto pl-5 text-[13px]">
              {failures.map((f) => (
                <li key={f.row}>{t('import.failedRow', { row: f.row, error: f.error })}</li>
              ))}
            </ul>
          )}
          <div className="app-modal-footer">
            <PrimaryActionButton onClick={close}>{t('buttons.close')}</PrimaryActionButton>
          </div>
        </div>
      )}
    </Modal>
  )
}
