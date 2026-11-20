import { useState } from 'react'
import { message } from 'antd'
import { FilePdf } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../atoms/AppButton'
import { downloadDashboardPdf } from './dashboardPdf'
import type { Insights } from './insights'

interface Props {
  audience: 'admin' | 'partner'
  data: Insights
  /** Shown under the report title, e.g. the restaurant's name. */
  subject?: string
}

/** Downloads the dashboard for the chosen period as a PDF report (GM-340). */
export function ExportPdfButton({ audience, data, subject }: Props) {
  const { t } = useTranslation('dashboard')
  const [busy, setBusy] = useState(false)
  const [messageApi, holder] = message.useMessage()

  const run = async () => {
    setBusy(true)
    try {
      await downloadDashboardPdf({ audience, data, subject, t })
    } catch {
      void messageApi.error(t('pdf.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {holder}
      <AppButton
        variant="secondary"
        onClick={run}
        disabled={busy}
        aria-busy={busy}
        data-testid="export-pdf"
      >
        <FilePdf size={16} aria-hidden />
        {busy ? t('pdf.preparing') : t('pdf.button')}
      </AppButton>
    </>
  )
}
