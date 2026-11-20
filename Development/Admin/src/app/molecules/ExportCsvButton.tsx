import { useState } from 'react'
import { message } from 'antd'
import { DownloadSimple } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../atoms/AppButton'
import { datedFileName, exportToCsv, type CsvColumn } from '../../shared/utils/csvExport'
import { getApiErrorMessage } from '../../shared/utils/apiError'

interface Props {
  /** File name without date or extension, e.g. "restaurants". */
  fileBase: string
  columns: CsvColumn[]
  /** Every row matching the list's current filters (all pages). */
  load: () => Promise<{ rows: Record<string, unknown>[]; truncated?: boolean }>
  testId?: string
}

/** "Export CSV": downloads every row that matches the list's current filters. */
export function ExportCsvButton({ fileBase, columns, load, testId = 'export-csv' }: Props) {
  const { t } = useTranslation('common')
  const [busy, setBusy] = useState(false)
  const [messageApi, holder] = message.useMessage()

  const run = async () => {
    setBusy(true)
    try {
      const { rows, truncated } = await load()
      exportToCsv(datedFileName(fileBase), rows, columns)
      if (truncated) void messageApi.warning(t('export.truncated', { count: rows.length }))
      else void messageApi.success(t('export.done', { count: rows.length }))
    } catch (e) {
      void messageApi.error(getApiErrorMessage(e, t('export.failed')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {holder}
      <AppButton variant="neutral" onClick={() => void run()} loading={busy} data-testid={testId}>
        <DownloadSimple size={16} aria-hidden />
        {t('export.csv')}
      </AppButton>
    </>
  )
}
