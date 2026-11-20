import { useState } from 'react'
import { Alert, Button } from 'antd'
import { useTranslation } from 'react-i18next'
import { InsightsDashboard } from '../../visual/InsightsDashboard'
import { PageSkeleton } from '../../visual/PageSkeleton'
import { ExportPdfButton } from '../../visual/ExportPdfButton'
import type { Range } from '../../visual/insights'
import { useDashboardQuery } from './useDashboardQuery'
import { usePartnerProfileQuery } from '../restaurants/partnerProfile/hooks/usePartnerProfileQueries'

/** The restaurant's dashboard: bookings, seats and payouts over time. */
export function DashboardPage() {
  const { t } = useTranslation('dashboard')
  const [range, setRange] = useState<Range>(30)
  const { data, isPending, isError, refetch } = useDashboardQuery(range)
  const profile = usePartnerProfileQuery()

  if (isPending) return <PageSkeleton variant="cards" count={4} label={t('title')} />
  if (isError || !data) {
    return (
      <Alert
        type="error"
        showIcon
        title={t('loadFailed')}
        action={
          <Button size="small" onClick={() => void refetch()}>
            {t('retry')}
          </Button>
        }
      />
    )
  }
  return (
    <InsightsDashboard
      audience="partner"
      data={data}
      range={range}
      onRange={setRange}
      tableHref={(table) => `/interest-tables/${table.id}`}
      actions={
        <ExportPdfButton audience="partner" data={data} subject={profile.data?.name ?? undefined} />
      }
    />
  )
}
